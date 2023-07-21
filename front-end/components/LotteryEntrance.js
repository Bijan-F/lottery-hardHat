import { useWeb3Contract } from "react-moralis";
import { abi, contractAddresses } from "../constants";
import { useMoralis } from "react-moralis";
import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { useNotification } from "web3uikit";

export default function LotteryEntrance() {
    const { chainId: chainIdHex, isWeb3Enabled } = useMoralis();
    const chainId = parseInt(chainIdHex);
    const lotteryAddress = chainId in contractAddresses ? contractAddresses[chainId][0] : null;
    const [entranceFee, setEntranceFee] = useState("0");
    const [numPlayers, setNumPlayers] = useState("0");
    const [recentWinner, setRecentWinner] = useState("0");

    const dispatch = useNotification();

    const { runContractFunction: enterLottery, isLoading, isFetching } = useWeb3Contract({
        abi: abi,
        contractAddress: lotteryAddress,
        functionName: "enterLottery",
        params: {},
        msgValue: entranceFee,
    })
    
    const { runContractFunction: getEntrance } = useWeb3Contract({
        abi: abi,
        contractAddress: lotteryAddress,
        functionName: "getEntrance",
        params: {},
    });
    
    const { runContractFunction: getNumberOfPlayers } = useWeb3Contract({
        abi: abi,
        contractAddress: lotteryAddress,
        functionName: "getNumberOfPlayers",
        params: {},
    });
    
    const { runContractFunction: getRecentWinner } = useWeb3Contract({
        abi: abi,
        contractAddress: lotteryAddress,
        functionName: "getRecentWinner",
        params: {},
    });

    async function updateUi() {
        const entranceFeeFromCall = (await getEntrance()).toString();
        const numPlayersFromCall = (await getNumberOfPlayers()).toString();
        const recentWinnerFromCall = await getRecentWinner();
        setEntranceFee(entranceFeeFromCall);
        setNumPlayers(numPlayersFromCall);
        setRecentWinner(recentWinnerFromCall);
    }

    useEffect(() => {
        if(isWeb3Enabled) {
            // try to read the entrance fee from lottery contract
            updateUi();
        }
    }, [isWeb3Enabled]);

    const handleSuccess = async function(tx) {
        await tx.wait(1);
        handleNewNotification(tx);
        updateUi();
    }

    const handleNewNotification = function() {
        dispatch({
            type: "info",
            message: "Transaction Complete!",
            title: "Tx Notification",
            position: "topR",
            icon: "bell",
        })
    }
    
    return (
        <div className="p-5">
            { lotteryAddress
            ? (
                <div>
                    <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded ml-auto" 
                    disabled={isFetching || isLoading}
                    onClick={async function() {
                        await enterLottery({ onSuccess: handleSuccess, onError: (error) => console.log(error) })
                    }}>
                        Enter Lottery
                    </button>
                    <div>Entrance Fee: {ethers.utils.formatUnits(entranceFee, "ether")} ETH</div><br />
                    <div>Number Of Players: {numPlayers}</div><br />
                    <div>Recent Winner: {recentWinner}</div>
                </div>
            )
            : (
            <div>No lottery address detected</div>
            )}
        </div>
    )
}