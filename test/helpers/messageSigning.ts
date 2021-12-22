import { ethers } from "hardhat";

export async function generateHashedMessage(
  // @ts-ignore
  sender, // @ts-ignore
  destination, // @ts-ignore
  feeToken, // @ts-ignore
  feeAmount, // @ts-ignore
  maxBlock, // @ts-ignore
  tokenAddr, // @ts-ignore
  signer
) {
  const abi = new ethers.utils.AbiCoder();

  const types = [
    "address",
    "uint256",
    "address",
    "uint256",
    "uint256",
    "address",
  ];
  const data = [sender, destination, feeToken, feeAmount, maxBlock, tokenAddr];

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
  tokenAddr, // @ts-ignore
  signer
) {
  const [hash, signature] = await generateHashedMessage(
    sender,
    destination,
    feeToken,
    feeAmount,
    maxBlock,
    tokenAddr,
    signer
  );

  const abi = new ethers.utils.AbiCoder();

  return abi.encode(
    ["address", "uint256", "uint256", "bytes32", "bytes"],
    [feeToken, feeAmount, maxBlock, hash, signature]
  );
}
