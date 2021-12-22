import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
// import { Contract } from "ethers";
// eslint-disable-next-line node/no-extraneous-import
import { deployMockContract } from "@ethereum-waffle/mock-contract";

const IERC20 = require("../artifacts/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol/IERC20Upgradeable.json");

// const zeroAddress = "0x0000000000000000000000000000000000000000";
// const oneAddress = "0x1111111111111111111111111111111111111111";

async function generateHashedMessage(
  // @ts-ignore
  sender, // @ts-ignore
  destination, // @ts-ignore
  feeToken, // @ts-ignore
  feeAmount, // @ts-ignore
  maxBlock, // @ts-ignore
  signer
) {
  const abi = new ethers.utils.AbiCoder();

  const types = ["address", "uint256", "address", "uint256", "uint256"];
  const data = [sender, destination, feeToken, feeAmount, maxBlock];

  const abiEncoded = abi.encode(types, data);

  const types1 = ["string"];
  const data1 = [abiEncoded];
  const abiEncoded1 = abi.encode(types1, data1);

  console.log(`ABI Encoded by test: ${abiEncoded}`);

  const message = ethers.utils.keccak256(abiEncoded);
  console.log(`Hash of encoded by test by test: ${message}`);

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

describe("Fee Verification Signature", function () {
  it("Verify a valid signature", async function () {
    const [owner, addr1] = await ethers.getSigners();

    // Initalize bridge
    const mockERC20 = await deployMockContract(owner, IERC20.abi);

    await mockERC20.mock.transferFrom.returns(true);
    await mockERC20.mock.transfer.returns(true);

    const Bridge = await ethers.getContractFactory("TollBridge");
    const bridge = await upgrades.deployProxy(Bridge, [owner.address]);
    await bridge.deployed();

    await bridge.setFeeVerifier(addr1.address);

    const verifier = await bridge.feeVerifier();

    expect(verifier).to.equal(addr1.address);

    console.log(`Verifier: ${verifier}, owner: ${owner.address}`);

    // Create signed message
    const dest = 1;
    const feeToken = mockERC20.address;
    const feeAmount = 100;
    const maxBlock = 99999999999;

    const [hash, signature] = await generateHashedMessage(
      owner.address,
      dest,
      feeToken,
      feeAmount,
      maxBlock,
      addr1
    );

    console.log(`Hash: ${hash}, Sig: ${signature}`);

    const result = await bridge.removeBeforeDeployTestVerifyFee(
      hash,
      signature,
      dest,
      feeToken,
      feeAmount,
      maxBlock
    );

    expect(result).to.equal(addr1.address);
  });
});
