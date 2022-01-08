import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";
// eslint-disable-next-line node/no-extraneous-import
import { deployMockContract } from "@ethereum-waffle/mock-contract";
// eslint-disable-next-line node/no-missing-import
import { generateFeeData } from "./helpers/messageSigning";

const IERC20 = require("../artifacts/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol/IERC20Upgradeable.json");
const IERC721 = require("../artifacts/contracts/IERC721Bridgable.sol/IERC721Bridgable.json");
const IERC1155 = require("../artifacts/contracts/IERC1155Bridgable.sol/IERC1155Bridgable.json");
const IMessageReceiver = require("../artifacts/contracts/IMessageReceiver.sol/IMessageReceiver.json");

describe("Toll Bridge", function () {
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  const fakeFeeTokenAddr = "0x1111111111111111111111111111111111111111";
  const noExpireBlock = 999999999;
  const feeAmount = 1000;
  let tollToken: Contract;

  beforeEach(async function () {
    // Setup the token to use for tolls

    const [owner] = await ethers.getSigners();
    tollToken = await deployMockContract(owner, IERC20.abi);

    tollToken.mock.transferFrom.returns(true);
    tollToken.mock.transfer.returns(true);
    // Each unit test may modify the mock returns
  });

  describe("ERC20 bridge", function () {
    it("Transfer a fungilbe token to another network with no fee", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const mockERC20 = await deployMockContract(owner, IERC20.abi);

      await mockERC20.mock.transferFrom.returns(true);
      await mockERC20.mock.transfer.returns(true);

      tollToken.mock.transferFrom.reverts(); // This function shouldn't be called

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
      ]);
      await bridge.deployed();

      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        2,
        fakeFeeTokenAddr,
        0,
        noExpireBlock,
        { tokenAddr: mockERC20.address, tokenAmount: 100 },
        "0x",
        false,
        addr1,
        bridge
      );

      // Transfer a token to network 2
      const transferTx = await bridge.transferFungible(
        mockERC20.address,
        100,
        2,
        feeData
      );

      const tx = await transferTx.wait();

      expect(tx.events?.length).to.equal(1);

      // @ts-ignore
      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(owner.address);
        expect(e.args?.token).to.equal(mockERC20.address);
        expect(parseInt(e.args?.amount)).to.equal(100);
        expect(parseInt(e.args?.networkId)).to.equal(2);
      });
    });

    it("Claim a fungible token that was transfered", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const mockERC20 = await deployMockContract(owner, IERC20.abi);

      await mockERC20.mock.transfer.returns(true);

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        tollToken.address,
      ]);
      await bridge.deployed();

      await mockERC20.mock.balanceOf.withArgs(bridge.address).returns(100);

      // Claim token
      const claimTx = await bridge.bridgeClaimFungible(
        mockERC20.address,
        addr1.address,
        100
      );
      const tx = await claimTx.wait();

      // @ts-ignore
      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(addr1.address);
        expect(e.args?.token).to.equal(mockERC20.address);
        expect(parseInt(e.args?.amount)).to.equal(100);
      });
    });

    it("Transfer a fungilbe token to another network with fee paid in ERC-20", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const mockERC20 = await deployMockContract(owner, IERC20.abi);

      await mockERC20.mock.transferFrom.returns(true);
      await mockERC20.mock.transfer.returns(true);

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
      ]);
      await bridge.deployed();

      // We'll use this to verify the fee is being taken
      await tollToken.mock.transferFrom
        .withArgs(owner.address, bridge.address, feeAmount)
        .revertsWithReason("Test Working");

      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        2,
        tollToken.address,
        feeAmount,
        noExpireBlock,
        { tokenAddr: mockERC20.address, tokenAmount: 100 },
        "0x",
        false,
        addr1,
        bridge
      );

      let pass: boolean = false;
      try {
        await bridge.transferFungible(mockERC20.address, 100, 2, feeData);
      } /* @ts-ignore */ catch (err) {
        if (err.toString().includes("Test Working")) {
          pass = true;
        } else {
          throw err;
        }
      }

      expect(pass).to.equal(true);
    });

    it("Transfer a fungilbe token to another network with fee paid in ETH", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const mockERC20 = await deployMockContract(owner, IERC20.abi);

      await mockERC20.mock.transferFrom.returns(true);
      await mockERC20.mock.transfer.returns(true);

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
      ]);
      await bridge.deployed();

      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        2,
        zeroAddress,
        feeAmount,
        noExpireBlock,
        { tokenAddr: mockERC20.address, tokenAmount: 100 },
        null,
        false,
        addr1,
        bridge
      );

      const transferTx = await bridge.transferFungible(
        mockERC20.address,
        100,
        2,
        feeData,
        { value: feeAmount }
      );

      const tx = await transferTx.wait();

      expect(tx.events?.length).to.equal(1);

      // @ts-ignore
      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(owner.address);
        expect(e.args?.token).to.equal(mockERC20.address);
        expect(parseInt(e.args?.amount)).to.equal(100);
        expect(parseInt(e.args?.networkId)).to.equal(2);
      });
    });
  });

  describe("ERC721 Bridge", function () {
    it("Transfer a non-fungilbe token to another network with no fee", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const mockERC721 = await deployMockContract(owner, IERC721.abi);

      await mockERC721.mock.transferFrom.returns();

      tollToken.mock.transferFrom.reverts(); // This function shouldn't be called

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
      ]);
      await bridge.deployed();

      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        2,
        tollToken.address,
        0,
        noExpireBlock,
        { tokenAddr: mockERC721.address, tokenId: 1 },
        "0x",
        false,
        addr1,
        bridge
      );

      // Transfer a token to network 2
      const transferTx = await bridge.transferNonFungible(
        mockERC721.address,
        1,
        2,
        feeData
      );

      const tx = await transferTx.wait();

      expect(tx.events?.length).to.equal(1);

      // @ts-ignore
      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(owner.address);
        expect(e.args?.token).to.equal(mockERC721.address);
        expect(parseInt(e.args?.tokenId)).to.equal(1);
        expect(parseInt(e.args?.networkId)).to.equal(2);
      });
    });

    it("Claim a non-fungible token that was transfered and the NFT exist and is owned by bridge contract", async function () {
      const [owner] = await ethers.getSigners();

      const mockERC721 = await deployMockContract(owner, IERC721.abi);

      await mockERC721.mock.transferFrom.returns();
      await mockERC721.mock.ownerOf.withArgs(1).reverts();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        tollToken.address,
      ]);
      await bridge.deployed();

      await mockERC721.mock.ownerOf.withArgs(1).returns(bridge.address);

      // Claim token
      const claimTx = await bridge.bridgeClaimNonFungible(
        mockERC721.address,
        owner.address,
        1
      );
      const tx = await claimTx.wait();

      // @ts-ignore
      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(owner.address);
        expect(e.args?.token).to.equal(mockERC721.address);
        expect(parseInt(e.args?.tokenId)).to.equal(1);
      });
    });

    it("Claim a non-fungible token that was transfered and the NFT does not exist", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const mockERC721 = await deployMockContract(owner, IERC721.abi);

      await mockERC721.mock.transferFrom.returns();
      await mockERC721.mock.ownerOf.withArgs(1).reverts();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
      ]);
      await bridge.deployed();

      await mockERC721.mock.ownerOf.withArgs(1).returns(bridge.address);

      // Claim token
      const claimTx = await bridge.bridgeClaimNonFungible(
        mockERC721.address,
        addr1.address,
        1
      );
      const tx = await claimTx.wait();

      // @ts-ignore
      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(addr1.address);
        expect(e.args?.token).to.equal(mockERC721.address);
        expect(parseInt(e.args?.tokenId)).to.equal(1);
      });
    });

    it("Transfer a non-fungilbe token to another network with fee in ERC-20", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const mockERC721 = await deployMockContract(owner, IERC721.abi);

      await mockERC721.mock.transferFrom.returns();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
      ]);
      await bridge.deployed();

      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        2,
        tollToken.address,
        feeAmount,
        noExpireBlock,
        { tokenAddr: mockERC721.address, tokenId: 1 },
        "0x",
        false,
        addr1,
        bridge
      );

      // We'll use this to verify the fee is being taken
      await tollToken.mock.transferFrom
        .withArgs(owner.address, bridge.address, feeAmount)
        .revertsWithReason("Test Working");

      let pass: boolean = false;
      // Transfer a token to network 2
      try {
        await bridge.transferNonFungible(mockERC721.address, 1, 2, feeData);
      } /* @ts-ignore */ catch (err) {
        if (err.toString().includes("Test Working")) {
          pass = true;
        } else {
          throw err;
        }
      }

      expect(pass).to.equal(true);
    });

    it("Transfer a non-fungilbe token to another network with fee in ETH", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const mockERC721 = await deployMockContract(owner, IERC721.abi);

      await mockERC721.mock.transferFrom.returns();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
      ]);
      await bridge.deployed();

      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        2,
        zeroAddress,
        feeAmount,
        noExpireBlock,
        { tokenAddr: mockERC721.address, tokenId: 1 },
        null,
        false,
        addr1,
        bridge
      );

      const transferTx = await bridge.transferNonFungible(
        mockERC721.address,
        1,
        2,
        feeData,
        { value: feeAmount }
      );

      const tx = await transferTx.wait();

      expect(tx.events?.length).to.equal(1);

      // @ts-ignore
      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(owner.address);
        expect(e.args?.token).to.equal(mockERC721.address);
        expect(parseInt(e.args?.tokenId)).to.equal(1);
        expect(parseInt(e.args?.networkId)).to.equal(2);
      });
    });
  });

  describe("ERC1155 bridge", function () {
    it("Transfer a mixed fungilbe token to another network with no fee", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const mockERC1155 = await deployMockContract(owner, IERC1155.abi);

      await mockERC1155.mock.safeTransferFrom.returns();

      tollToken.mock.transferFrom.reverts(); // This function shouldn't be called

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
      ]);
      await bridge.deployed();

      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        2,
        tollToken.address,
        0,
        noExpireBlock,
        { tokenAddr: mockERC1155.address, tokenId: 1, tokenAmount: 100 },
        "0x",
        false,
        addr1,
        bridge
      );

      // Transfer a token to network 2
      const transferTx = await bridge.transferMixedFungible(
        mockERC1155.address,
        1,
        100,
        2,
        feeData
      );

      const tx = await transferTx.wait();

      expect(tx.events?.length).to.equal(1);

      // @ts-ignore
      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(owner.address);
        expect(e.args?.token).to.equal(mockERC1155.address);
        expect(parseInt(e.args?.tokenId)).to.equal(1);
        expect(parseInt(e.args?.amount)).to.equal(100);
        expect(parseInt(e.args?.networkId)).to.equal(2);
      });
    });

    it("Transfer a mixed fungilbe token to another network with fee in ERC-20", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const mockERC1155 = await deployMockContract(owner, IERC1155.abi);

      await mockERC1155.mock.safeTransferFrom.returns();

      tollToken.mock.transferFrom.reverts(); // This function shouldn't be called

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
      ]);
      await bridge.deployed();

      // We'll use this to verify the fee is being taken
      await tollToken.mock.transferFrom
        .withArgs(owner.address, bridge.address, feeAmount)
        .revertsWithReason("Test Working");

      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        2,
        tollToken.address,
        feeAmount,
        noExpireBlock,
        { tokenAddr: mockERC1155.address, tokenId: 1, tokenAmount: 100 },
        "0x",
        false,
        addr1,
        bridge
      );

      let pass: boolean = false;
      try {
        await bridge.transferMixedFungible(
          mockERC1155.address,
          1,
          100,
          2,
          feeData
        );
      } /* @ts-ignore */ catch (err) {
        if (err.toString().includes("Test Working")) {
          pass = true;
        } else {
          throw err;
        }
      }

      expect(pass).to.equal(true);
    });

    it("Transfer a mixed fungilbe token to another network with fee in ETH", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const mockERC1155 = await deployMockContract(owner, IERC1155.abi);

      await mockERC1155.mock.safeTransferFrom.returns();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
      ]);
      await bridge.deployed();

      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        2,
        zeroAddress,
        feeAmount,
        noExpireBlock,
        { tokenAddr: mockERC1155.address, tokenId: 1, tokenAmount: 100 },
        null,
        false,
        addr1,
        bridge
      );

      const transferTx = await bridge.transferMixedFungible(
        mockERC1155.address,
        1,
        100,
        2,
        feeData,
        { value: feeAmount }
      );
      const tx = await transferTx.wait();

      expect(tx.events?.length).to.equal(1);

      // @ts-ignore
      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(owner.address);
        expect(e.args?.token).to.equal(mockERC1155.address);
        expect(parseInt(e.args?.tokenId)).to.equal(1);
        expect(parseInt(e.args?.amount)).to.equal(100);
        expect(parseInt(e.args?.networkId)).to.equal(2);
      });
    });

    it("Claim a mixed fungible token that was transfered", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const mockERC1155 = await deployMockContract(owner, IERC1155.abi);

      await mockERC1155.mock.safeTransferFrom.returns();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
      ]);
      await bridge.deployed();

      await mockERC1155.mock.balanceOf.withArgs(bridge.address, 1).returns(100);

      // Claim token
      const claimTx = await bridge.bridgeClaimMixedFungible(
        mockERC1155.address,
        addr1.address,
        1,
        100
      );
      const tx = await claimTx.wait();

      // @ts-ignore
      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(addr1.address);
        expect(e.args?.token).to.equal(mockERC1155.address);
        expect(parseInt(e.args?.tokenId)).to.equal(1);
        expect(parseInt(e.args?.amount)).to.equal(100);
      });
    });
  });

  describe("Arbitrary message bridge", function () {
    // @ts-ignore
    let encodedMessage;
    // @ts-ignore
    let decodedMessage;

    before(function () {
      const abi = new ethers.utils.AbiCoder();

      decodedMessage = {
        types: ["string", "uint256"],
        data: ["This is a message", 17], // 17 is the length of the message
      };

      encodedMessage = abi.encode(decodedMessage.types, decodedMessage.data);
    });

    it("Send an arbitrary message to another network with ERC-20 fee", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
      ]);
      await bridge.deployed();

      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        100,
        tollToken.address,
        feeAmount,
        noExpireBlock,
        { tokenAddr: addr1.address },
        // @ts-ignore
        encodedMessage,
        false,
        addr1,
        bridge
      );

      const messageTx = await bridge.sendMessage(
        1, // Message ID
        100, // Destination Network
        addr1.address, // Recipient
        false, // Request delivery receipt
        // @ts-ignore
        encodedMessage, // Message
        feeData
      );

      const tx = await messageTx.wait();

      expect(tx.events?.length).to.equal(1);

      // @ts-ignore
      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(owner.address);
        expect(parseInt(e.args?.messageId)).to.equal(1);
        expect(parseInt(e.args?.destination)).to.equal(100);
        expect(e.args?.recipient).to.equal(addr1.address);
        expect(e.args?.receipt).to.equal(false);
        // @ts-ignore
        expect(e.args?.message).to.equal(encodedMessage);
      });
    });

    it("Send an arbitrary message to another network with ETH fee", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
      ]);
      await bridge.deployed();

      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        100,
        zeroAddress,
        feeAmount,
        noExpireBlock,
        addr1.address,
        // @ts-ignore
        encodedMessage,
        false,
        addr1,
        bridge
      );

      const messageTx = await bridge.sendMessage(
        1, // Message ID
        100, // Destination Network
        addr1.address, // Recipient
        false, // Request delivery receipt
        // @ts-ignore
        encodedMessage, // Message
        feeData,
        { value: feeAmount }
      );

      const tx = await messageTx.wait();

      expect(tx.events?.length).to.equal(1);

      // @ts-ignore
      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(owner.address);
        expect(parseInt(e.args?.messageId)).to.equal(1);
        expect(parseInt(e.args?.destination)).to.equal(100);
        expect(e.args?.recipient).to.equal(addr1.address);
        expect(e.args?.receipt).to.equal(false);
        // @ts-ignore
        expect(e.args?.message).to.equal(encodedMessage);
      });
    });

    it("Send an arbitrary message broadcast with ERC-20 fee", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
      ]);
      await bridge.deployed();

      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        0,
        tollToken.address,
        feeAmount,
        noExpireBlock,
        zeroAddress,
        // @ts-ignore
        encodedMessage,
        false,
        addr1,
        bridge
      );

      const broadcastTx = await bridge.sendBroadcast(
        1, // Message ID
        false, // Request delivery receipt
        // @ts-ignore
        encodedMessage, // Message
        feeData
      );

      const tx = await broadcastTx.wait();

      expect(tx.events?.length).to.equal(1);

      // @ts-ignore
      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(owner.address);
        expect(parseInt(e.args?.messageId)).to.equal(1);
        expect(e.args?.receipt).to.equal(false);
        // @ts-ignore
        expect(e.args?.message).to.equal(encodedMessage);
      });
    });

    it("Send an arbitrary message broadcast with ETH fee", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
      ]);
      await bridge.deployed();

      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        0,
        zeroAddress,
        feeAmount,
        noExpireBlock,
        zeroAddress,
        // @ts-ignore
        encodedMessage,
        false,
        addr1,
        bridge
      );

      const broadcastTx = await bridge.sendBroadcast(
        1, // Message ID
        false, // Request delivery receipt
        // @ts-ignore
        encodedMessage, // Message
        feeData,
        { value: feeAmount }
      );

      const tx = await broadcastTx.wait();

      expect(tx.events?.length).to.equal(1);

      // @ts-ignore
      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(owner.address);
        expect(parseInt(e.args?.messageId)).to.equal(1);
        expect(e.args?.receipt).to.equal(false);
        // @ts-ignore
        expect(e.args?.message).to.equal(encodedMessage);
      });
    });

    it("Simulate receiving a message", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
      ]);
      await bridge.deployed();

      // Create mock message receiver
      const mockReceiver = await deployMockContract(
        owner,
        IMessageReceiver.abi
      );

      await mockReceiver.mock.receiveBridgeMessage.returns(false);

      const relayTx = await bridge.relayMessage(
        mockReceiver.address, // Recipient
        1, // MessageId
        owner.address, // Sender
        100, // From network
        // @ts-ignore
        encodedMessage // Message
      );

      const tx = await relayTx.wait();

      expect(tx.events?.length).to.equal(1);

      // @ts-ignore
      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(owner.address);
        expect(e.args?.receiver).to.equal(mockReceiver.address);
        expect(e.args?.success).to.equal(false);
        expect(e.args?.messageId).to.equal(1);
      });
    });
  });
});
