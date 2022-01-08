import { ethers } from "hardhat";

const zeroAddress = "0x0000000000000000000000000000000000000000";

export async function generateHashedMessage(
  chainId: number,
  // @ts-ignore
  sender, // @ts-ignore
  destination, // @ts-ignore
  feeToken, // @ts-ignore
  feeAmount, // @ts-ignore
  maxBlock, // @ts-ignore
  { tokenAddr, tokenId, tokenAmount }, // @ts-ignore
  messageData,
  requestReceipt: boolean, // @ts-ignore
  signer
) {
  const abi = new ethers.utils.AbiCoder();

  // Pack message with tokenAddress and requestReciept
  // @ts-ignore
  let packedMessage;

  if (!messageData || messageData === "0x") {
    // console.log("Packing in token mode");
    if (tokenId && tokenAmount) {
      packedMessage = abi.encode(
        ["address", "uint256", "uint256"],
        [tokenAddr, tokenId, tokenAmount]
      );
    } else if (tokenId) {
      packedMessage = abi.encode(["address", "uint256"], [tokenAddr, tokenId]);
    } else if (tokenAmount) {
      packedMessage = abi.encode(
        ["address", "uint256"],
        [tokenAddr, tokenAmount]
      );
    }
  } else if (tokenAddr !== zeroAddress && tokenAddr) {
    // console.log("Packing in message mode");
    packedMessage = abi.encode(
      ["bytes", "bool", "string"],
      [messageData, requestReceipt, tokenAddr]
    );
  } else {
    // console.log("Packing in broadcast mode");
    packedMessage = abi.encode(
      ["bytes", "bool"],
      [messageData, requestReceipt]
    );
  }

  const types = [
    "uint256",
    "address",
    "uint256",
    "address",
    "uint256",
    "uint256",
    "bytes",
  ];
  const data = [
    chainId,
    sender,
    destination,
    feeToken,
    feeAmount,
    maxBlock,
    packedMessage,
  ];

  const abiEncoded = abi.encode(types, data);

  // console.log(`ABI Encoded by test: ${abiEncoded}`);

  const message = ethers.utils.keccak256(abiEncoded);
  // console.log(`Hash of encoded by test by test: ${message}`);

  /* const message = ethers.utils.id(
    `${sender}${destination}${feeToken}${feeAmount}${maxBlock}`
  ); */
  // const message = ethers.utils.id("test");

  const messageBuffer = Buffer.from(message.substring(2), "hex");
  const prefix = Buffer.from(
    `\u0019Ethereum Signed Message:\n${messageBuffer.length}`
  );
  const hash = ethers.utils.keccak256(Buffer.concat([prefix, messageBuffer]));

  const messageHash = ethers.utils.arrayify(message);

  const signature /* flatSig */ = await signer.signMessage(messageHash);
  // const signature = ethers.utils.splitSignature(flatSig);

  return [hash, signature];
}

export async function generateFeeData(
  // @ts-ignore
  sender, // @ts-ignore
  destination, // @ts-ignore
  feeToken, // @ts-ignore
  feeAmount, // @ts-ignore
  maxBlock, // @ts-ignore
  tokenData, // @ts-ignore
  messageData,
  requestReceipt: boolean, // @ts-ignore
  signer, // @ts-ignore
  contract // Can just be any contract that has a function called 'chainId' that returns the chainId, this can also just be a number
) {
  let chainId: number;
  if (typeof contract === "number") {
    chainId = contract;
  } else {
    chainId = await contract.chainId();
  }

  const [hash, signature] = await generateHashedMessage(
    chainId,
    sender,
    destination,
    feeToken,
    feeAmount,
    maxBlock,
    tokenData,
    messageData,
    requestReceipt,
    signer
  );

  const abi = new ethers.utils.AbiCoder();

  return abi.encode(
    ["address", "uint256", "uint256", "bytes32", "bytes"],
    [feeToken, feeAmount, maxBlock, hash, signature]
  );
}
