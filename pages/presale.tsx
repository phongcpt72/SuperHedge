import React, { useState, useEffect, useMemo } from "react";
import { ethers } from "ethers";
import { PrimaryButton } from "../components/basic";
import { useAccount, useSigner, useNetwork } from "wagmi";
import { SUPPORT_CHAIN_IDS } from "../utils/enums";
import PresaleABI from "../utils/abis/Presale.json";
import ERC20ABI from "../utils/abis/ERC20.json"
import { DECIMAL } from "../utils/constants";

const Presale = () => {
    const { data: signer } = useSigner();
    const { address } = useAccount();
    const { chain } = useNetwork();

    const [isFetching, setIsFetching] = useState(false);
    const [numberOfNFTs, setNumberOfNFTs] = useState(0);
    const [mintingMax, setMintingMax] = useState(0);
    const [selectedCurrency, setSelectedCurrency] = useState<Currency>("ETH");
    const [estimatedAmount, setEstimatedAmount] = useState(0);
    const [txHash, setTxHash] = useState("");
    const [showWarning, setShowWarning] = useState(false); // State for warning message
    const chainId = chain ? chain.id : SUPPORT_CHAIN_IDS.ARBITRUM;

    const presaleAddress = '0x0e8DD19e8AF1637Cf5B2a2103B81858dE4A84cE3'

    const presaleInstance = useMemo(() => {
        if (!signer || !address) return null;
        return new ethers.Contract(presaleAddress, PresaleABI, signer);
    }, [signer, address]);

    // Currency addresses
    const currencyAddresses: { [key: string]: string | undefined } = {
        USDC: "0x90158fae6BFE835C2c5604218ecC49627B94a9E4",
        USDT: "0x90158fae6BFE835C2c5604218ecC49627B94a9E4",
        ETH: undefined,
    };

    useEffect(() => {
        (async () => {
            if (presaleInstance) {
                const mintMax = await presaleInstance.mintingLimits()
                setMintingMax(mintMax.toNumber())
            }
        })();
    },);

    // Define a type for the currency
    type Currency = 'USDC' | 'USDT' | 'ETH';

    const calculateEstimate = (nfts: number, currency: number) => {
        return nfts * currency;
    };

    useEffect(() => {
        (async () => {
            if (numberOfNFTs >= 0 && selectedCurrency && presaleInstance) {
                // const mintMax = await presaleInstance.mintingLimits()
                // console.log(mintMax.toNumber())
                // setMintingMax(mintMax.toNumber())
                if (selectedCurrency === 'ETH') {
                    const tokenPrice = await presaleInstance.pricePerETH();
                    setEstimatedAmount(calculateEstimate(numberOfNFTs, Number(ethers.utils.formatUnits(tokenPrice.toNumber(), 18))));
                } else {
                    const info = await presaleInstance.tokenInfoList(currencyAddresses[selectedCurrency]);
                    const tokenPrice = await info.price.toNumber();
                    setEstimatedAmount(calculateEstimate(numberOfNFTs, Number(ethers.utils.formatUnits(tokenPrice, DECIMAL[chainId]))));
                }
            }
        })();
    }, [numberOfNFTs, selectedCurrency]);

    const handleCurrencySelect = (currency: Currency) => {
        setSelectedCurrency(currency);
        setTxHash("");
    };

    const handleConfirm = async () => {
        if (signer && numberOfNFTs > 0 && selectedCurrency && presaleInstance && estimatedAmount) {
            setIsFetching(true);
            try {
                let txResponse;
                if (selectedCurrency === 'ETH') {
                    const totalAmount = ethers.utils.parseEther(estimatedAmount.toString());
                    txResponse = await presaleInstance.mintEth(numberOfNFTs, {
                        value: totalAmount 
                    });
                } else {
                    const currencyAddress = currencyAddresses[selectedCurrency];
                    console.log(estimatedAmount)
                    if (currencyAddress) {
                        const tokenAddressInstance = new ethers.Contract(currencyAddress, ERC20ABI, signer)
                        const decimal = await tokenAddressInstance.decimals()
                        const requestBalance = ethers.utils.parseUnits(estimatedAmount.toFixed(decimal), decimal);
                        const currentAllowance = await tokenAddressInstance.allowance(address, presaleAddress)
                        console.log(currentAllowance)
                        if (currentAllowance.lt(estimatedAmount)) {
                            const tx = await tokenAddressInstance.approve(presaleAddress, requestBalance)
                            await tx.wait()
                        }
                        txResponse = await presaleInstance.mintToken(currencyAddress, numberOfNFTs);
                    }
                }
                await txResponse.wait();
                setTxHash(txResponse.hash);
            } catch (error) {
                console.error("Error during confirmation:", error);
            } finally {
                setIsFetching(false);
            }
        }
    };

    return (
        <div className={"py-[84px] flex justify-center"}>
            <div className={"max-w-[650px] w-full"}>
                <div className={"flex flex-col items-center w-full bg-white rounded-[16px]"}>
                    <div className={"relative w-full h-[230px] rounded-[16px] bg-dark-gradient"}>
                        <img src={"/profile/banner.svg"} alt={"profile banner"} className={"absolute right-0 top-0"} />
                        <span className={"text-[44px] leading-[44px] text-whitenew-100 absolute left-[45px] bottom-[40px] max-w-[300px]"}>
                            Presale
                        </span>
                    </div>
                    <div className={"flex flex-col w-full px-[80px] py-[56px]"}>
                        {/* Warning Message */}
                        {showWarning && (
                            <div className="mb-2 text-red-500">
                                You cannot select more than {mintingMax} NFTs!
                            </div>
                        )}

                        {/* Input for Number of NFTs */}
                        <input
                            type="number"
                            value={numberOfNFTs}
                            onChange={(e) => {
                                const value = Number(e.target.value);
                                if (value > mintingMax) {
                                    setShowWarning(true); 
                                    setNumberOfNFTs(mintingMax); 
                                } else {
                                    setShowWarning(false); 
                                    setNumberOfNFTs(value);
                                }
                            }}
                            className="border rounded px-2 py-1 mb-4"
                            placeholder="Enter number of NFTs"
                        />

                        {/* Button Selection for Currency */}
                        <div className="flex mb-4">
                            <button 
                                onClick={() => handleCurrencySelect('ETH')} 
                                className={`border rounded px-4 py-2 ${selectedCurrency === 'ETH' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
                                ETH
                            </button>
                            <button 
                                onClick={() => handleCurrencySelect('USDC')} 
                                className={`border rounded px-4 py-2 mx-2 ${selectedCurrency === 'USDC' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
                                USDC
                            </button>
                            <button 
                                onClick={() => handleCurrencySelect('USDT')} 
                                className={`border rounded px-4 py-2 ${selectedCurrency === 'USDT' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
                                USDT
                            </button>
                        </div>

                        {/* Display Estimated Amount */}
                        {estimatedAmount > 0 && (
                            <div className="mb-4">
                                <strong>Estimated Price:</strong> {estimatedAmount} {selectedCurrency}
                            </div>
                        )}

                        {/* Display Transaction Hash */}
                        {txHash && (
                            <div className="mb-4">
                                <strong>Transaction Hash</strong>
                                <div 
                                    onClick={() => window.open(`https://arbiscan.io/tx/${txHash}`, "_blank")}
                                    className="text-blue-500 cursor-pointer underline"
                                >
                                    {txHash}
                                </div>
                            </div>
                        )}

                        {/* Confirm Button */}
                        <PrimaryButton 
                            label={isFetching ? 'Processing...' : 'Confirm'} 
                            className={"mt-10 max-w-[220px]"} 
                            onClick={handleConfirm} 
                            disabled={numberOfNFTs <= 0 || !selectedCurrency} // Disable if no input or selection
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Presale;