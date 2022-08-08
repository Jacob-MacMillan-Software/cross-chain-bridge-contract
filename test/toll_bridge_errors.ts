import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import {
  generateFeeData,
  generateHashedMessage,
  // eslint-disable-next-line node/no-missing-import
} from "./helpers/messageSigning";

const ERC20Mock = require("../artifacts/contracts/mocks/ERC20Mock.sol/ERC20Mock.json");
// const ERC721Mock = require("../artifacts/contracts/mocks/ERC721Mock.sol/ERC721Mock.json");
// const ERC1155Mock = require("../artifacts/contracts/mocks/ERC1155Mock.sol/ERC1155Mock.json");
// const MessageReceiverMock = require("../artifacts/contracts/mocks/MessageReceiverMock.sol/MessageReceiverMock.json");

describe("Toll Bridge Errors", function () {
  const fakeFeeTokenAddr = "0x1111111111111111111111111111111111111111";
  const noExpireBlock = 999999999;
  const feeAmount = 1000;
  let tollToken: typeof ERC20Mock;

  beforeEach(async function () {
    // Setup the token to use for tolls
    const [owner, addr1] = await ethers.getSigners();

    tollToken = await ethers.getContractFactory("ERC20Mock");
    tollToken = await tollToken.deploy("Toll", "TOLL");
    await tollToken.deployed();

    await tollToken.mint(owner.address, "100000000000000000000");
    await tollToken.mint(addr1.address, "100000000000000000000");
  });

  describe("ERC20 bridge errors", function () {
    let mockERC20: typeof ERC20Mock;

    beforeEach(async function () {
      const [owner] = await ethers.getSigners();

      mockERC20 = await ethers.getContractFactory("ERC20Mock");
      mockERC20 = await mockERC20.deploy("Test", "TST");

      await mockERC20.mint(owner.address, "100000000000000000000");
    });

    it("Fail to transfer an ERC20 token with an empty fee verification", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
        1,
      ]);
      await bridge.deployed();

      await mockERC20.approve(bridge.address, 0xffffffffff);

      let failed = false;
      try {
        await bridge.transferFungible(
          mockERC20.address,
          100,
          2,
          ethers.constants.HashZero
        );
      } catch (err) {
        failed = true;
      }
      // eslint-disable-next-line no-unused-expressions
      expect(failed).to.be.true;
    });

    it("Fail to Transfer a fungilbe token with unauthorized signer on fee", async function () {
      const [owner, addr1, addr2] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
        1,
      ]);
      await bridge.deployed();

      await mockERC20.approve(bridge.address, 0xffffffffff);

      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        2,
        fakeFeeTokenAddr,
        0,
        noExpireBlock,
        { tokenAddr: mockERC20.address, tokenAmount: 100 },
        null,
        false,
        addr2,
        bridge
      );

      let failed = false;
      try {
        await bridge.transferFungible(mockERC20.address, 100, 2, feeData);
      } catch (err) {
        if (
          // @ts-ignore
          err.message.includes(
            `reverted with custom error 'UntrustedSigner("${addr2.address}")'`
          )
        ) {
          failed = true;
        }
      }

      // eslint-disable-next-line no-unused-expressions
      expect(failed).to.be.true;
    });

    it("Fail to transfer an ERC20 without paying the fee, in ETH", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
        1,
      ]);
      await bridge.deployed();

      await mockERC20.approve(bridge.address, 0xffffffffff);

      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        2,
        ethers.constants.AddressZero,
        1000,
        noExpireBlock,
        { tokenAddr: mockERC20.address, tokenAmount: 100 },
        null,
        false,
        addr1,
        bridge
      );

      let failed = false;
      try {
        await bridge.transferFungible(mockERC20.address, 100, 2, feeData);
      } catch (err) {
        if (
          // @ts-ignore
          err.message.includes(
            "reverted with custom error 'IncorrectFeeAmount(0, 1000)'"
          )
        ) {
          failed = true;
        }
      }

      // eslint-disable-next-line no-unused-expressions
      expect(failed).to.be.true;
    });

    // This test really only tests to make sure that the bridge attempts to pull the fee. Technically, if there's a malicious fee token the user could still avoid paying
    // Malicious fee tokens should be prevented by the bridge relay
    it("fail to Transfer a fungilbe token to another network without paying fee in ERC-20 (not approved)", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
        1,
      ]);
      await bridge.deployed();

      // await tollToken.approve(bridge.address, 0xffffffffff);
      await mockERC20.approve(bridge.address, 0xffffffffff);

      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        2,
        tollToken.address,
        feeAmount,
        noExpireBlock,
        { tokenAddr: mockERC20.address, tokenAmount: 100 },
        null,
        false,
        addr1,
        bridge
      );

      let failed = false;
      try {
        await bridge.transferFungible(mockERC20.address, 100, 2, feeData);
      } catch (err) {
        if (
          // @ts-ignore
          err.message.includes(
            "reverted with reason string 'ERC20: transfer amount exceeds allowance'"
          )
        ) {
          failed = true;
        }
      }

      // eslint-disable-next-line no-unused-expressions
      expect(failed).to.be.true;
    });

    // This test really only tests to make sure that the bridge attempts to pull the fee. Technically, if there's a malicious fee token the user could still avoid paying
    // Malicious fee tokens should be prevented by the bridge relay
    it("fail to Transfer a fungilbe token to another network without paying fee in ERC-20 (insufficient funds)", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
        1,
      ]);
      await bridge.deployed();

      await tollToken.approve(bridge.address, ethers.constants.MaxUint256);
      await mockERC20.approve(bridge.address, 0xffffffffff);

      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        2,
        tollToken.address,
        ethers.constants.MaxUint256,
        noExpireBlock,
        { tokenAddr: mockERC20.address, tokenAmount: 100 },
        null,
        false,
        addr1,
        bridge
      );

      let failed = false;
      try {
        await bridge.transferFungible(mockERC20.address, 100, 2, feeData);
      } catch (err) {
        if (
          // @ts-ignore
          err.message.includes(
            "reverted with reason string 'ERC20: transfer amount exceeds balance'"
          )
        ) {
          failed = true;
        }
      }

      // eslint-disable-next-line no-unused-expressions
      expect(failed).to.be.true;
    });

    it("fail to Transfer a fungilbe token to another network without paying fee in ERC-20 (pay fee in ETH)", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
        1,
      ]);
      await bridge.deployed();

      // await tollToken.approve(bridge.address, 0xffffffffff);
      await mockERC20.approve(bridge.address, 0xffffffffff);

      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        2,
        tollToken.address,
        feeAmount,
        noExpireBlock,
        { tokenAddr: mockERC20.address, tokenAmount: 100 },
        null,
        false,
        addr1,
        bridge
      );

      let failed = false;
      try {
        await bridge.transferFungible(mockERC20.address, 100, 2, feeData, {
          value: feeAmount,
        });
      } catch (err) {
        if (
          // @ts-ignore
          err.message.includes(
            "reverted with custom error 'FunctionNotPayable()'"
          )
        ) {
          failed = true;
        }
      }

      // eslint-disable-next-line no-unused-expressions
      expect(failed).to.be.true;
    });

    it("fail to Transfer a fungilbe token to another network with a modified fee verification (signature is valid, but from a different verification. Fee amount changed to 0, all other elements unchanged)", async function () {
      const [owner, addr1] = await ethers.getSigners();
      const abi = new ethers.utils.AbiCoder();
      const types = ["address", "uint256", "uint256", "bytes32", "bytes"];

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
        1,
      ]);
      await bridge.deployed();

      await mockERC20.approve(bridge.address, 0xffffffffff);

      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        2,
        ethers.constants.AddressZero,
        feeAmount,
        noExpireBlock,
        { tokenAddr: mockERC20.address, tokenAmount: 100 },
        null,
        false,
        addr1,
        bridge
      );

      // Decode the feeData
      const [feeToken, oldFeeAmount, maxBlock, hash, signature] = abi.decode(
        types,
        feeData
      );

      // Verify this was correctly decoded
      expect(feeToken).to.equal(ethers.constants.AddressZero);
      expect(oldFeeAmount).to.equal(feeAmount);
      expect(maxBlock).to.equal(noExpireBlock);

      const newFeeAmount = 0;
      const forgedFeeData = abi.encode(types, [
        feeToken,
        newFeeAmount,
        maxBlock,
        hash,
        signature,
      ]);

      let failed = false;
      try {
        await bridge.transferFungible(mockERC20.address, 100, 2, forgedFeeData);
      } catch (err) {
        if (
          // @ts-ignore
          err.message.includes(
            'reverted with custom error \'HashMismatch("0xe36f6c1541ec1a332d2e95c86eeae27c2b70b7e85481512c7c6b8999ad3fe734", "0xd5d3023786a79e8bc9e22cad26fc4b086faff56200394f86593e8800324bb1f5")\''
          )
        ) {
          failed = true;
        }
      }

      // eslint-disable-next-line no-unused-expressions
      expect(failed).to.be.true;
    });

    it("fail to Transfer a fungilbe token to another network with a modified fee verification (signature is valid, but from a different verification. Fee amount changed to 0 and hashed changed to match, all other elements unchanged)", async function () {
      const [owner, addr1, addr2] = await ethers.getSigners();
      const abi = new ethers.utils.AbiCoder();
      const types = ["address", "uint256", "uint256", "bytes32", "bytes"];

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
        1,
      ]);
      await bridge.deployed();

      await mockERC20.approve(bridge.address, 0xffffffffff);

      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        2,
        ethers.constants.AddressZero,
        feeAmount,
        noExpireBlock,
        { tokenAddr: mockERC20.address, tokenAmount: 100 },
        null,
        false,
        addr1,
        bridge
      );

      // Decode the feeData
      const [feeToken, oldFeeAmount, maxBlock, , signature] = abi.decode(
        types,
        feeData
      );

      // Verify this was correctly decoded
      expect(feeToken).to.equal(ethers.constants.AddressZero);
      expect(oldFeeAmount).to.equal(feeAmount);
      expect(maxBlock).to.equal(noExpireBlock);

      const newFeeAmount = 0;

      // Hash new data
      const [hash] = await generateHashedMessage(
        await bridge.chainId(),
        owner.address,
        2,
        ethers.constants.AddressZero,
        newFeeAmount,
        noExpireBlock,
        { tokenAddr: mockERC20.address, tokenAmount: 100, tokenId: null },
        null,
        false,
        addr2
      );

      const forgedFeeData = abi.encode(types, [
        feeToken,
        newFeeAmount,
        maxBlock,
        hash,
        signature,
      ]);

      let failed = false;
      try {
        await bridge.transferFungible(mockERC20.address, 100, 2, forgedFeeData);
      } catch (err) {
        if (
          // @ts-ignore
          err.message.includes(
            "reverted with custom error 'UntrustedSigner(\"0x5c26722a3A215E2dB53bbE442b95E531d565aFFe\")'"
          )
        ) {
          failed = true;
        }
      }

      // eslint-disable-next-line no-unused-expressions
      expect(failed).to.be.true;
    });
  });
});
