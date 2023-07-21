const { assert, expect } = require("chai");
const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
? describe.skip
: describe("Lottery", function() {
    let vrfCoordinatorV2Mock, lottery, lotteryEntranceFee, deployer, interval;
    const chainId = network.config.chainId;

    beforeEach(async function() {
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture(["all"]);
        lottery = await ethers.getContract("Lottery", deployer);
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
        lotteryEntranceFee = await lottery.getEntrance();
        interval = await lottery.getInterval();
    });

    describe("constructor", function() {
        it("Should initializes the lottery correctly", async function() {
            const lotteryState = await lottery.getLotteryState();
            const interval = await lottery.getInterval();
            assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
            assert.equal(lotteryState.toString(), "0");
        });
    });
    describe("enterLottery", function() {
        it("Should reverts if you don't pay enough", async function() {
            expect(lottery.enterLottery()).to.be.revertedWith("Lottery__notEnoughETHEntered");
        });
        it("Should record players when they enter.", async function() {
            await lottery.enterLottery({ value: lotteryEntranceFee });
            const playerFromContract = await lottery.getPlayers(0);
            assert.equal(playerFromContract, deployer);
        });
        it("Should emits event on enter", async function() {
            await expect(lottery.enterLottery({ value: lotteryEntranceFee })).to.emit(lottery, "LotteryEnter");
        });
        it("Should not allow entrance when lottery is calculating", async function() {
            await lottery.enterLottery({ value: lotteryEntranceFee });
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
            await network.provider.send("evm_mine", []);
            // We pretend to be chainlink keeper
            await lottery.performUpkeep([]);
            expect(lottery.enterLottery({ value: lotteryEntranceFee })).to.be.revertedWith("Lottery__NotOpen");
        });
    });
    describe("checkUpkeep", function() {
        it("Should returns false if people have not sent any ETH", async function() {
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
            await network.provider.send("evm_mine", []);
            const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
            assert(!upkeepNeeded);
        });
        it("Should return false if lottery isn't open", async function() {
            await lottery.enterLottery({ value: lotteryEntranceFee });
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
            await network.provider.send("evm_mine", []);
            await lottery.performUpkeep([]); // performUpkeep("0x") is the same as this
            const lotteryState = await lottery.getLotteryState();
            const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
            assert.equal(lotteryState.toString(), "1");
            assert.equal(upkeepNeeded, false);
        });
    });
    describe("performUpkeep", function() {
        it("Can only run if checkUpkeep is true", async function() {
            await lottery.enterLottery({ value: lotteryEntranceFee });
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
            await network.provider.send("evm_mine", []);
            const tx = await lottery.performUpkeep([]);
            assert(tx);
        });
        it("Should reverts if checkUpkeep is false", async function() {
            expect(lottery.performUpkeep([])).to.be.revertedWith("Lottery__UpkeepNotNeeded");
        });
        it("Should updates the state, calls the vrfCoordinatorV2 and emits an event", async function() {
            await lottery.enterLottery({ value: lotteryEntranceFee });
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
            await network.provider.send("evm_mine", []);
            const txResponse = await lottery.performUpkeep([]);
            const txReceipt = await txResponse.wait(1);
            const requestId = txReceipt.events[1].args.requestId;
            const lotteryState = await lottery.getLotteryState();
            assert(requestId.toNumber() > 0);
            assert(lotteryState == 1);
        });
    });
    describe("fulfillRandomWords", function() {
        beforeEach(async function() {
            await lottery.enterLottery({ value: lotteryEntranceFee });
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
            await network.provider.send("evm_mine", []);
        });
        it("Can only be called after performUpkeep", async function() {
            await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, lottery.address)).to.be.revertedWith("nonexistent request");
            await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, lottery.address)).to.be.revertedWith("nonexistent request");
        });
        // Biiig ass test
        it("Should picks a winner, resets the lottery and sends the money", async function() {
            const additionalEntrants = 3;
            const startingAccountIndex = 1; // Deployer = 0
            const accounts = await ethers.getSigners();

            for(i = startingAccountIndex; i < startingAccountIndex + additionalEntrants; i++) {
                const accountConnectedLottery = await lottery.connect(accounts[i]);
                await accountConnectedLottery.enterLottery({ value: lotteryEntranceFee });
            };

            const startingTimeStamp = await lottery.getLatestTimeStamp();
            await new Promise(async (resolve, reject) => {
                lottery.once("WinnerPicked", async () => {
                    console.log("Found the event!");
                    try {
                        const recentWinner = await lottery.getRecentWinner();
                        console.log(recentWinner);
                        console.log(accounts[0].address);
                        console.log(accounts[1].address);
                        console.log(accounts[2].address);
                        console.log(accounts[3].address);
                        const numPlayers = await lottery.getNumberOfPlayers();
                        const lotteryState = await lottery.getLotteryState();
                        const endingTimeStamp = await lottery.getLatestTimeStamp();
                        const winnerEndingBalance = await accounts[1].getBalance();   
                        assert.equal(numPlayers.toString(), "0");
                        assert.equal(lotteryState.toString(), "0");
                        assert(endingTimeStamp > startingTimeStamp);
                        assert.equal(
                            winnerEndingBalance.toString(),
                            winnerStartingBalance.add(
                                lotteryEntranceFee
                                    .mul(additionalEntrants)
                                    .add(lotteryEntranceFee)
                                    .toString()
                            )
                        );
                    } catch (e) {
                        reject(e);
                        console.log(e);
                    };
                    resolve();
                })

                const tx = await lottery.performUpkeep([]);
                const txReceipt = await tx.wait(1);
                const winnerStartingBalance = await accounts[1].getBalance();
                await vrfCoordinatorV2Mock.fulfillRandomWords(
                    txReceipt.events[1].args.requestId,
                    lottery.address
                );

            });
        })
    });
});