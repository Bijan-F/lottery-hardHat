const { assert, expect } = require("chai");
const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");

developmentChains.includes(network.name)
? describe.skip
: describe("Lottery", function() {
    let lottery, lotteryEntranceFee, deployer;

    beforeEach(async function() {
        deployer = (await getNamedAccounts()).deployer;
        lottery = await ethers.getContract("Lottery", deployer);
        lotteryEntranceFee = await lottery.getEntrance();
    });
    
    describe("fulfillRandomWords", function() {
        it("Should works with Chainlink Keeper and Chainlink VRF, We get a random winner!", async function() {
            // Entering the lottery
            
            console.log("Setting up test...");
            const startingTimeStamp = await lottery.getLatestTimeStamp();
            const accounts = await ethers.getSigners();
            
            // Setting up listener before we enter the lottery
            // Just in case the blockchain moves really fast
            new Promise(async (resolve, reject) => {
                lottery.once("WinnerPicked", async () => {
                    console.log("Winner Picked!");
                    try {
                        // asserts
                        const recentWinner = await lottery.getRecentWinner();
                        const lotteryState = await lottery.getLotteryState();
                        const winnerEndingBalance = await accounts[0].getBalance();
                        const endingTimeStamp = await lottery.getLatestTimeStamp();
                        
                        await expect(lottery.getPlayers((0))).to.be.reverted
                        assert.equal(recentWinner.toString(), accounts[0].address);
                        assert.equal(lotteryState, 0);
                        assert.equal(
                            winnerEndingBalance.toString(),
                            winnerStartingBalance
                            .add(lotteryEntranceFee)
                            .toString()
                            );
                            assert(endingTimeStamp > startingTimeStamp);
                            resolve();
                        } catch(error) {
                            console.log(error);
                            reject(error);
                        }
                    })
                    // Then entering the lottery
                    console.log("Entering the lottery...");
                    const tx = await lottery.enterLottery({ value: lotteryEntranceFee });
                    await tx.wait(1);
                    console.log("Ok, Time to wait...");
                    const winnerStartingBalance = await accounts[0].getBalance();
                // and this code WON'T complete until our listener has finished listening
            })
        })
    });
});