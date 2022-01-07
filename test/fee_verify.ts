import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
// import { Contract } from "ethers";
// eslint-disable-next-line node/no-extraneous-import
import { deployMockContract } from "@ethereum-waffle/mock-contract";
// eslint-disable-next-line node/no-missing-import
import { generateHashedMessage } from "./helpers/messageSigning";

const zeroAddress = "0x0000000000000000000000000000000000000000";

const IERC20 = require("../artifacts/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol/IERC20Upgradeable.json");
const abi = new ethers.utils.AbiCoder();

const testMessage = abi.encode(["string"], ["test"]);

describe("Fee Verification Signature", function () {
  it("Verify a valid signature", async function () {
    const [owner, addr1] = await ethers.getSigners();

    // Initalize bridge
    const mockERC20 = await deployMockContract(owner, IERC20.abi);

    await mockERC20.mock.transferFrom.returns(true);
    await mockERC20.mock.transfer.returns(true);

    const Bridge = await ethers.getContractFactory("FeeVerifyTester");
    const bridge = await upgrades.deployProxy(Bridge, [
      owner.address,
      owner.address,
    ]);
    await bridge.deployed();

    const chainId = await bridge.chainId();

    await bridge.setFeeVerifier(addr1.address);

    const verifier = await bridge.feeVerifier();

    expect(verifier).to.equal(addr1.address);

    console.log(`Verifier: ${verifier}, owner: ${owner.address}`);

    // Create signed message
    const dest = 100;
    const feeToken = mockERC20.address;
    const feeAmount = 100;
    const maxBlock = 99999999999;

    const [hash, signature] = await generateHashedMessage(
      chainId,
      owner.address,
      dest,
      feeToken,
      feeAmount,
      maxBlock,
      mockERC20.address,
      testMessage,
      true,
      addr1
    );

    console.log(`Hash: ${hash}, Sig: ${signature}`);

    const result = await bridge.testVerifyFee(
      dest,
      abi.encode(
        ["bytes", "bool", "string"],
        [testMessage, true, mockERC20.address]
      ),
      abi.encode(
        ["address", "uint256", "uint256", "bytes32", "bytes"],
        [feeToken, feeAmount, maxBlock, hash, signature]
      )
    );

    expect(result).to.equal(addr1.address);
  });

  it("Give expired signature and revert", async function () {
    const [owner, addr1] = await ethers.getSigners();

    // Initalize bridge
    const mockERC20 = await deployMockContract(owner, IERC20.abi);

    await mockERC20.mock.transferFrom.returns(true);
    await mockERC20.mock.transfer.returns(true);

    const Bridge = await ethers.getContractFactory("FeeVerifyTester");
    const bridge = await upgrades.deployProxy(Bridge, [
      owner.address,
      owner.address,
    ]);
    await bridge.deployed();

    const chainId = await bridge.chainId();

    await bridge.setFeeVerifier(addr1.address);

    const verifier = await bridge.feeVerifier();

    expect(verifier).to.equal(addr1.address);

    console.log(`Verifier: ${verifier}, owner: ${owner.address}`);

    // Create signed message
    const dest = 100;
    const feeToken = mockERC20.address;
    const feeAmount = 100;
    const maxBlock = 0;

    const [hash, signature] = await generateHashedMessage(
      chainId,
      owner.address,
      dest,
      feeToken,
      feeAmount,
      maxBlock,
      mockERC20.address,
      testMessage,
      true,
      addr1
    );

    console.log(`Hash: ${hash}, Sig: ${signature}`);

    let failed = false;
    try {
      await bridge.testVerifyFee(
        dest,
        testMessage,
        abi.encode(
          ["address", "uint256", "uint256", "bytes32", "bytes"],
          [feeToken, feeAmount, maxBlock, hash, signature]
        )
      );
    } catch (err) {
      if (
        // @ts-ignore
        err
          .toString()
          .includes(
            "reverted with reason string 'TollBridge: Fee validation expired'"
          )
      ) {
        failed = true;
      } else {
        // @ts-ignore
        throw err;
      }
    }

    expect(failed).to.equal(true);
  });

  it("Check gas prices of each step in fee validation process", async function () {
    const [owner, addr1] = await ethers.getSigners();

    // Initalize bridge
    const mockERC20 = await deployMockContract(owner, IERC20.abi);

    await mockERC20.mock.transferFrom.returns(true);
    await mockERC20.mock.transfer.returns(true);

    const Bridge = await ethers.getContractFactory("FeeVerifyTester");
    const bridge = await upgrades.deployProxy(Bridge, [
      owner.address,
      addr1.address,
    ]);
    await bridge.deployed();

    const chainId = await bridge.chainId();

    // Create signed message
    const dest = 100;
    const feeToken = mockERC20.address;
    const feeAmount = 100;
    const maxBlock = 99999999999;

    const [hash, signature] = await generateHashedMessage(
      chainId,
      owner.address,
      dest,
      feeToken,
      feeAmount,
      maxBlock,
      zeroAddress,
      testMessage,
      true,
      addr1
    );

    await bridge.gasTester(
      testMessage,
      abi.encode(
        ["address", "uint256", "uint256", "bytes32", "bytes"],
        [feeToken, feeAmount, maxBlock, hash, signature]
      )
    );
  });
});
