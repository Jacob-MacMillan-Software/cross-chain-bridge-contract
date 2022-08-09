import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";
// eslint-disable-next-line node/no-missing-import
import { generateFeeData } from "./helpers/messageSigning";

const ERC20Mock = require("../artifacts/contracts/mocks/ERC20Mock.sol/ERC20Mock.json");
const ERC721Mock = require("../artifacts/contracts/mocks/ERC721Mock.sol/ERC721Mock.json");
const ERC1155Mock = require("../artifacts/contracts/mocks/ERC1155Mock.sol/ERC1155Mock.json");
const MessageReceiverMock = require("../artifacts/contracts/mocks/MessageReceiverMock.sol/MessageReceiverMock.json");

// These tests do not run the relay itself. instead it performs a series of transactions, which the relay will complete
// All the tests bridge the tokens to the same network. This wouldn't be done in practice (at least probably not), but it makes the tests simpler, and is effectively exactly the same
// (with some exceptions that are accounted for in the other tests)
describe("Toll Bridge with Real Relay", function () {
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  const noExpireBlock = 999999999;
  const feeAmount = 1000;
  let tollToken: typeof ERC20Mock;
  let bridge: Contract;
  const owner = new ethers.Wallet( // This private key is publicly known. It's from ganache's deterministic seed
    "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d"
  );

  before(async function () {
    // Setup the token to use for tolls
    tollToken = await ethers.getContractFactory("ERC20Mock");
    tollToken = await tollToken.deploy("Toll", "TOLL");
    await tollToken.deployed();

    await tollToken.mint(owner.address, "100000000000000000000");

    // Initialize bridge
    const Bridge = await ethers.getContractFactory("TollBridge");
    bridge = await upgrades.deployProxy(Bridge, [owner.address, 100]);
    await bridge.deployed();

    console.log(`ChainID: ${await bridge.chainId()}`);

    // Approve bridge to take fee in toll token
    await tollToken.approve(bridge.address, 0xffffffffff);

    console.log(`Bridge address: ${bridge.address}`);
  });

  describe("ERC20 bridge", function () {
    let mockERC20: typeof ERC20Mock;

    before(async function () {
      mockERC20 = await ethers.getContractFactory("ERC20Mock");
      mockERC20 = await mockERC20.deploy("Test", "TST");
      await mockERC20.deployed();

      console.log(`ERC20 address: ${mockERC20.address}`);
      console.log(`Owner: ${owner.address}`);

      await mockERC20.mint(owner.address, "100000000000000000000");
      await mockERC20.approve(bridge.address, 0xffffffffff);
    });

    it("Transfer a fungilbe token to another network with no fee", async function () {
      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        100,
        zeroAddress,
        0,
        noExpireBlock,
        { tokenAddr: mockERC20.address, tokenAmount: 100 },
        null,
        false,
        owner,
        bridge
      );

      // Transfer a token to network 2
      const transferTx = await bridge.transferFungible(
        mockERC20.address,
        100,
        100,
        feeData
      );

      const tx = await transferTx.wait();

      expect(tx.events.length).to.equal(3);

      const bridgeTxEvent = tx.events[2];
      expect(bridgeTxEvent.args.from).to.equal(owner.address);
      expect(bridgeTxEvent.args.token).to.equal(mockERC20.address);
      expect(parseInt(bridgeTxEvent.args.amount)).to.equal(100);
      expect(parseInt(bridgeTxEvent.args.networkId)).to.equal(100);
    });

    it("Transfer a fungilbe token to another network with fee paid in ERC-20", async function () {
      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        100,
        tollToken.address,
        feeAmount,
        noExpireBlock,
        { tokenAddr: mockERC20.address, tokenAmount: 100 },
        null,
        false,
        owner,
        bridge
      );

      const transferTx = await bridge.transferFungible(
        mockERC20.address,
        100,
        100,
        feeData
      );
      const tx = await transferTx.wait();

      expect(tx.events.length).to.equal(5); // Approval, transfer x2, bridge transfer

      // Only bridge transfer event has e?.args for some reason
      const bridgeTxEvent = tx.events[2];
      expect(bridgeTxEvent.args.from).to.equal(owner.address);
      expect(bridgeTxEvent.args.token).to.equal(mockERC20.address);
      expect(parseInt(bridgeTxEvent.args.amount)).to.equal(100);
      expect(parseInt(bridgeTxEvent.args.networkId)).to.equal(100);
    });

    it("Transfer a fungilbe token to another network with fee paid in ETH", async function () {
      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        100,
        zeroAddress,
        feeAmount,
        noExpireBlock,
        { tokenAddr: mockERC20.address, tokenAmount: 100 },
        null,
        false,
        owner,
        bridge
      );

      const transferTx = await bridge.transferFungible(
        mockERC20.address,
        100,
        100,
        feeData,
        { value: feeAmount }
      );

      const tx = await transferTx.wait();

      expect(tx.events.length).to.equal(3);

      const bridgeTxEvent = tx.events[2];
      expect(bridgeTxEvent.args.from).to.equal(owner.address);
      expect(bridgeTxEvent.args.token).to.equal(mockERC20.address);
      expect(parseInt(bridgeTxEvent.args.amount)).to.equal(100);
      expect(parseInt(bridgeTxEvent.args.networkId)).to.equal(100);
    });
  });

  describe("ERC721 Bridge", function () {
    let mockERC721: typeof ERC721Mock;

    before(async function () {
      mockERC721 = await ethers.getContractFactory("ERC721Mock");
      mockERC721 = await mockERC721.deploy("Test", "TST");
      await mockERC721.deployed();

      // Mint 100 tokens to owner
      for (let i = 0; i < 100; i++) await mockERC721.mint(owner.address, i);
      await mockERC721.setApprovalForAll(bridge.address, true);

      console.log(`ERC721 address: ${mockERC721.address}`);
    });

    it("Transfer a non-fungilbe token to another network with no fee", async function () {
      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        100,
        tollToken.address,
        0,
        noExpireBlock,
        { tokenAddr: mockERC721.address, tokenId: 1 },
        null,
        false,
        owner,
        bridge
      );

      // Transfer a token to network 2
      const transferTx = await bridge.transferNonFungible(
        mockERC721.address,
        1,
        100,
        feeData
      );

      const tx = await transferTx.wait();

      expect(tx.events.length).to.equal(3);

      const bridgeTransferEvent = tx.events[2];
      expect(bridgeTransferEvent.args.from).to.equal(owner.address);
      expect(bridgeTransferEvent.args.token).to.equal(mockERC721.address);
      expect(parseInt(bridgeTransferEvent.args.tokenId)).to.equal(1);
      expect(parseInt(bridgeTransferEvent.args.networkId)).to.equal(100);
    });

    it("Transfer a non-fungilbe token to another network with fee in ERC-20", async function () {
      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        100,
        tollToken.address,
        feeAmount,
        noExpireBlock,
        { tokenAddr: mockERC721.address, tokenId: 2 },
        null,
        false,
        owner,
        bridge
      );

      const transferTx = await bridge.transferNonFungible(
        mockERC721.address,
        2,
        100,
        feeData
      );
      const tx = await transferTx.wait();

      expect(tx.events.length).to.equal(5);

      const bridgeTransferEvent = tx.events[2];
      expect(bridgeTransferEvent.args.from).to.equal(owner.address);
      expect(bridgeTransferEvent.args.token).to.equal(mockERC721.address);
      expect(parseInt(bridgeTransferEvent.args.tokenId)).to.equal(2);
      expect(parseInt(bridgeTransferEvent.args.networkId)).to.equal(100);
    });

    it("Transfer a non-fungilbe token to another network with fee in ETH", async function () {
      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        100,
        zeroAddress,
        feeAmount,
        noExpireBlock,
        { tokenAddr: mockERC721.address, tokenId: 3 },
        null,
        false,
        owner,
        bridge
      );

      const transferTx = await bridge.transferNonFungible(
        mockERC721.address,
        3,
        100,
        feeData,
        { value: feeAmount }
      );

      const tx = await transferTx.wait();

      expect(tx.events.length).to.equal(3);

      const bridgeTransferEvent = tx.events[2];
      expect(bridgeTransferEvent.args.from).to.equal(owner.address);
      expect(bridgeTransferEvent.args.token).to.equal(mockERC721.address);
      expect(parseInt(bridgeTransferEvent.args.tokenId)).to.equal(3);
      expect(parseInt(bridgeTransferEvent.args.networkId)).to.equal(100);
    });
  });

  describe("ERC1155 bridge", function () {
    let mockERC1155: typeof ERC1155Mock;

    before(async function () {
      mockERC1155 = await ethers.getContractFactory("ERC1155Mock");
      mockERC1155 = await mockERC1155.deploy("testuri/");
      await mockERC1155.deployed();

      console.log(`ERC1155 address: ${mockERC1155.address}`);

      await mockERC1155.mintBatch(
        owner.address,
        [1, 2, 3, 4],
        [100, 100, 100, 100],
        "0x"
      );

      await mockERC1155.setApprovalForAll(bridge.address, true);
    });

    it("Transfer a mixed fungilbe token to another network with no fee", async function () {
      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        100,
        tollToken.address,
        0,
        noExpireBlock,
        { tokenAddr: mockERC1155.address, tokenId: 1, tokenAmount: 100 },
        null,
        false,
        owner,
        bridge
      );

      // Transfer a token to network 2
      const transferTx = await bridge.transferMixedFungible(
        mockERC1155.address,
        1,
        100,
        100,
        feeData
      );

      const tx = await transferTx.wait();

      expect(tx.events.length).to.equal(2);

      const bridgeTransferEvent = tx.events[1];
      expect(bridgeTransferEvent.args.from).to.equal(owner.address);
      expect(bridgeTransferEvent.args.token).to.equal(mockERC1155.address);
      expect(parseInt(bridgeTransferEvent.args.tokenId)).to.equal(1);
      expect(parseInt(bridgeTransferEvent.args.amount)).to.equal(100);
      expect(parseInt(bridgeTransferEvent.args.networkId)).to.equal(100);
    });

    it("Transfer a mixed fungilbe token to another network with fee in ERC-20", async function () {
      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        100,
        tollToken.address,
        feeAmount,
        noExpireBlock,
        { tokenAddr: mockERC1155.address, tokenId: 2, tokenAmount: 100 },
        "0x",
        false,
        owner,
        bridge
      );

      const transferTx = await bridge.transferMixedFungible(
        mockERC1155.address,
        2,
        100,
        100,
        feeData
      );

      const tx = await transferTx.wait();

      expect(tx.events.length).to.equal(4);

      const bridgeTransferEvent = tx.events[1];
      expect(bridgeTransferEvent.args.from).to.equal(owner.address);
      expect(bridgeTransferEvent.args.token).to.equal(mockERC1155.address);
      expect(parseInt(bridgeTransferEvent.args.tokenId)).to.equal(2);
      expect(parseInt(bridgeTransferEvent.args.amount)).to.equal(100);
      expect(parseInt(bridgeTransferEvent.args.networkId)).to.equal(100);
    });

    it("Transfer a mixed fungilbe token to another network with fee in ETH", async function () {
      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        100,
        zeroAddress,
        feeAmount,
        noExpireBlock,
        { tokenAddr: mockERC1155.address, tokenId: 3, tokenAmount: 100 },
        null,
        false,
        owner,
        bridge
      );

      const transferTx = await bridge.transferMixedFungible(
        mockERC1155.address,
        3,
        100,
        100,
        feeData,
        { value: feeAmount }
      );
      const tx = await transferTx.wait();

      expect(tx.events.length).to.equal(2);

      const bridgeTransferEvent = tx.events[1];
      expect(bridgeTransferEvent.args.from).to.equal(owner.address);
      expect(bridgeTransferEvent.args.token).to.equal(mockERC1155.address);
      expect(parseInt(bridgeTransferEvent.args.tokenId)).to.equal(3);
      expect(parseInt(bridgeTransferEvent.args.amount)).to.equal(100);
      expect(parseInt(bridgeTransferEvent.args.networkId)).to.equal(100);
    });
  });

  describe("Arbitrary message bridge", function () {
    type plainMessage = {
      types: Array<string>;
      data: Array<string>;
    };

    let encodedMessage: string;
    let decodedMessage: plainMessage;
    let hardFailMessage: string;
    let softFailMessage: string;

    let mockMessageReceiver: typeof MessageReceiverMock;

    before(async function () {
      const abi = new ethers.utils.AbiCoder();

      decodedMessage = {
        types: ["string", "uint256"],
        data: ["This is a message", "17"], // 17 is the length of the message
      };

      encodedMessage = abi.encode(decodedMessage.types, decodedMessage.data);

      hardFailMessage = abi.encode(["string"], ["FAIL"]);
      softFailMessage = abi.encode(["string"], ["fail"]);

      // Initialize message receiver
      mockMessageReceiver = await ethers.getContractFactory(
        "MessageReceiverMock"
      );
      mockMessageReceiver = await mockMessageReceiver.deploy();

      mockMessageReceiver.setHardFail(hardFailMessage, true);
      mockMessageReceiver.setSoftFail(softFailMessage, true);

      console.log(`MessageReceiver address: ${mockMessageReceiver.address}`);
    });

    it("Send an arbitrary message to another network with ERC-20 fee", async function () {
      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        100,
        tollToken.address,
        feeAmount,
        noExpireBlock,
        { tokenAddr: mockMessageReceiver.address },
        hardFailMessage,
        true,
        owner,
        bridge
      );

      const messageTx = await bridge.sendMessage(
        1, // Message ID
        100, // Destination Network
        mockMessageReceiver.address, // Recipient
        true, // Request delivery receipt
        hardFailMessage, // Message
        feeData
      );

      const tx = await messageTx.wait();

      expect(tx.events.length).to.equal(3);

      const messageSendEvent = tx.events[0];
      expect(messageSendEvent.args.from).to.equal(owner.address);
      expect(parseInt(messageSendEvent.args.messageId)).to.equal(1);
      expect(parseInt(messageSendEvent.args.destination)).to.equal(100);
      expect(messageSendEvent.args.recipient).to.equal(
        mockMessageReceiver.address
      );
      expect(messageSendEvent.args.receipt).to.equal(true);
      expect(messageSendEvent.args.message).to.equal(hardFailMessage);
    });

    it("Send an arbitrary message to another network with ETH fee", async function () {
      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        100,
        zeroAddress,
        feeAmount,
        noExpireBlock,
        { tokenAddr: mockMessageReceiver.address },
        encodedMessage,
        false,
        owner,
        bridge
      );

      const messageTx = await bridge.sendMessage(
        1, // Message ID
        100, // Destination Network
        mockMessageReceiver.address, // Recipient
        false, // Request delivery receipt
        // @ts-ignore
        encodedMessage, // Message
        feeData,
        { value: feeAmount }
      );

      const tx = await messageTx.wait();

      expect(tx.events.length).to.equal(1);

      const messageSendEvent = tx.events[0];
      expect(messageSendEvent.args.from).to.equal(owner.address);
      expect(parseInt(messageSendEvent.args.messageId)).to.equal(1);
      expect(parseInt(messageSendEvent.args.destination)).to.equal(100);
      expect(messageSendEvent.args.recipient).to.equal(
        mockMessageReceiver.address
      );
      expect(messageSendEvent.args.receipt).to.equal(false);
      expect(messageSendEvent.args.message).to.equal(encodedMessage);
    });

    it("Send an arbitrary message broadcast with ERC-20 fee", async function () {
      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        0,
        tollToken.address,
        feeAmount,
        noExpireBlock,
        { tokenAddr: zeroAddress },
        encodedMessage,
        false,
        owner,
        bridge
      );

      const broadcastTx = await bridge.sendBroadcast(
        1, // Message ID
        false, // Request delivery receipt
        encodedMessage, // Message
        feeData
      );

      const tx = await broadcastTx.wait();

      expect(tx.events.length).to.equal(3);

      const messageSendEvent = tx.events[0];
      expect(messageSendEvent.args.from).to.equal(owner.address);
      expect(parseInt(messageSendEvent.args.messageId)).to.equal(1);
      expect(messageSendEvent.args.receipt).to.equal(false);
      expect(messageSendEvent.args.message).to.equal(encodedMessage);
    });

    it("Send an arbitrary message broadcast with ETH fee", async function () {
      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        0,
        zeroAddress,
        feeAmount,
        noExpireBlock,
        { tokenAddr: zeroAddress },
        encodedMessage,
        false,
        owner,
        bridge
      );

      const broadcastTx = await bridge.sendBroadcast(
        1, // Message ID
        false, // Request delivery receipt
        encodedMessage, // Message
        feeData,
        { value: feeAmount }
      );

      const tx = await broadcastTx.wait();

      expect(tx.events.length).to.equal(1);

      const messageSendEvent = tx.events[0];
      expect(messageSendEvent.args.from).to.equal(owner.address);
      expect(parseInt(messageSendEvent.args.messageId)).to.equal(1);
      expect(messageSendEvent.args.receipt).to.equal(false);
      expect(messageSendEvent.args.message).to.equal(encodedMessage);
    });
  });
});
