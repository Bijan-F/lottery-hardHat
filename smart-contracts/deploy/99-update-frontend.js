const { ethers, network } = require("hardhat");
const fs = require("fs");

const FRONT_END_ADDRESSES_PATH = "../front-end/constants/contractAddresses.json";
const FRONT_END_ABI_PATH = "../front-end/constants/abi.json";

module.exports = async function() {
    if(process.env.UPDATE_FRONT_END) {
        console.log("Updating Front-end...");
        updateContractAddresses();
        updateAbi();
    }
}

async function updateAbi() {
    const lottery = await ethers.getContract("Lottery");
    fs.writeFileSync(FRONT_END_ABI_PATH, lottery.interface.format(ethers.utils.FormatTypes.json));
}

async function updateContractAddresses() {
    const lottery = await ethers.getContract("Lottery");
    const chainId = network.config.chainId.toString();
    const currentAddresses = JSON.parse(fs.readFileSync(FRONT_END_ADDRESSES_PATH, "utf8"));
    if (chainId in currentAddresses) {
        if (!currentAddresses[chainId].includes(lottery.address)) {
            currentAddresses[chainId].push(lottery.address);
        }
    } {
        currentAddresses[chainId] = [lottery.address]
    }
    fs.writeFileSync(FRONT_END_ADDRESSES_PATH, JSON.stringify(currentAddresses))
}

module.exports.tags = ["all", "frontend"];