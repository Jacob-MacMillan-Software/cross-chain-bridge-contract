import { expect } from "chai";
import { ethers } from "hardhat";

const ERC20Mock = require("../artifacts/contracts/mocks/ERC20Mock.sol/ERC20Mock.json");
const ERC721Mock = require("../artifacts/contracts/mocks/ERC721Mock.sol/ERC721Mock.json");
const ERC1155Mock = require("../artifacts/contracts/mocks/ERC1155Mock.sol/ERC1155Mock.json");
const MessageReceiverMock = require("../artifacts/contracts/mocks/MessageReceiverMock.sol/MessageReceiverMock.json");

describe("Bridge", function () {
  describe("ERC20 bridge", function () {
    let mockERC20: typeof ERC20Mock;

    beforeEach(async function () {
      const [owner] = await ethers.getSigners();

      mockERC20 = await ethers.getContractFactory("ERC20Mock");
      mockERC20 = await mockERC20.deploy("Test", "TST");

      await mockERC20.mint(owner.address, "100000000000000000000");
    });

    it("Transfer a fungilbe token to another network", async function () {
      const [owner] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("BridgeDeployable");
      const bridge = await Bridge.deploy();
      await bridge.deployed();

      // Initialzie bridge
      await bridge.initialize(owner.address);

      await mockERC20.approve(bridge.address, 0xffffffffff);

      // Transfer a token to network 2
      const transferTx = await bridge.transferFungible(
        mockERC20.address,
        100,
        2,
        "0x"
      );

      const tx = await transferTx.wait();
      // @ts-ignore
      expect(tx.events.length).to.equal(3);
      // @ts-ignore
      const bridgeTxEvent = tx.events[2]; // @ts-ignore
      expect(bridgeTxEvent.args.from).to.equal(owner.address); // @ts-ignore
      expect(bridgeTxEvent.args.token).to.equal(mockERC20.address); // @ts-ignore
      expect(parseInt(bridgeTxEvent.args.amount)).to.equal(100); // @ts-ignore
      expect(parseInt(bridgeTxEvent.args.networkId)).to.equal(2);
    });

    it("Claim a fungible token that was transfered", async function () {
      const [owner] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("BridgeDeployable");
      const bridge = await Bridge.deploy();
      await bridge.deployed();

      // Initialzie bridge
      await bridge.initialize(owner.address);

      await mockERC20.mint(bridge.address, 0xffffffffff);

      // Claim token
      const claimTx = await bridge.bridgeClaimFungible(
        mockERC20.address,
        owner.address,
        100
      );
      const tx = await claimTx.wait();

      // @ts-ignore
      expect(tx.events.length).to.equal(2);

      // @ts-ignore
      const bridgeClaimEvent = tx.events[1]; // @ts-ignore
      expect(bridgeClaimEvent.args.from).to.equal(owner.address); // @ts-ignore
      expect(bridgeClaimEvent.args.token).to.equal(mockERC20.address); // @ts-ignore
      expect(parseInt(bridgeClaimEvent.args.amount)).to.equal(100);
    });
  });

  describe("ERC721 Bridge", function () {
    let mockERC721: typeof ERC721Mock;

    beforeEach(async function () {
      const [owner] = await ethers.getSigners();

      mockERC721 = await ethers.getContractFactory("ERC721Mock");
      mockERC721 = await mockERC721.deploy("Test", "TST");

      // Mint 100 tokens to owner
      for (let i = 0; i < 100; i++) await mockERC721.mint(owner.address, i);
    });

    it("Transfer a non-fungilbe token to another network", async function () {
      const [owner] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("BridgeDeployable");
      const bridge = await Bridge.deploy();
      await bridge.deployed();

      // Initialzie bridge
      await bridge.initialize(owner.address);

      await mockERC721.setApprovalForAll(bridge.address, true);

      // Transfer a token to network 2
      const transferTx = await bridge.transferNonFungible(
        mockERC721.address,
        1,
        2,
        "0x"
      );

      const tx = await transferTx.wait();
      // @ts-ignore
      expect(tx.events.length).to.equal(3);
      // @ts-ignore
      const bridgeTransferEvent = tx.events[2]; // @ts-ignore
      expect(bridgeTransferEvent.args.from).to.equal(owner.address); // @ts-ignore
      expect(bridgeTransferEvent.args.token).to.equal(mockERC721.address); // @ts-ignore
      expect(parseInt(bridgeTransferEvent.args.tokenId)).to.equal(1); // @ts-ignore
      expect(parseInt(bridgeTransferEvent.args.networkId)).to.equal(2); // @ts-ignore
    });

    it("Claim a non-fungible token that was transfered and the NFT exist and is owned by bridge contract", async function () {
      const [owner] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("BridgeDeployable");
      const bridge = await Bridge.deploy();
      await bridge.deployed();

      // Initialzie bridge
      await bridge.initialize(owner.address);

      await mockERC721.mint(bridge.address, 101);

      // Claim token
      const claimTx = await bridge.bridgeClaimNonFungible(
        mockERC721.address,
        owner.address,
        101
      );
      const tx = await claimTx.wait();
      // @ts-ignore
      expect(tx.events.length).to.equal(3);
      // @ts-ignore
      const bridgeClaimEvent = tx.events[2]; // @ts-ignore
      expect(bridgeClaimEvent.args.from).to.equal(owner.address); // @ts-ignore
      expect(bridgeClaimEvent.args.token).to.equal(mockERC721.address); // @ts-ignore
      expect(parseInt(bridgeClaimEvent.args.tokenId)).to.equal(101); // @ts-ignore
    });
  });

  describe("ERC1155 bridge", function () {
    let mockERC1155: typeof ERC1155Mock;

    beforeEach(async function () {
      const [owner] = await ethers.getSigners();

      mockERC1155 = await ethers.getContractFactory("ERC1155Mock");
      mockERC1155 = await mockERC1155.deploy("testuri/");

      await mockERC1155.mintBatch(
        owner.address,
        [1, 2, 3, 4],
        [100, 100, 100, 100],
        "0x"
      );
    });

    it("Transfer a fungilbe token to another network", async function () {
      const [owner] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("BridgeDeployable");
      const bridge = await Bridge.deploy();
      await bridge.deployed();

      // Initialzie bridge
      await bridge.initialize(owner.address);

      await mockERC1155.setApprovalForAll(bridge.address, true);

      // Transfer a token to network 2
      const transferTx = await bridge.transferMixedFungible(
        mockERC1155.address,
        1,
        100,
        2,
        "0x"
      );

      const tx = await transferTx.wait();
      // @ts-ignore
      expect(tx.events.length).to.equal(2);
      // @ts-ignore
      const bridgeTransferEvent = tx.events[1]; // @ts-ignore
      expect(bridgeTransferEvent.args.from).to.equal(owner.address); // @ts-ignore
      expect(bridgeTransferEvent.args.token).to.equal(mockERC1155.address); // @ts-ignore
      expect(parseInt(bridgeTransferEvent.args.tokenId)).to.equal(1); // @ts-ignore
      expect(parseInt(bridgeTransferEvent.args.amount)).to.equal(100); // @ts-ignore
      expect(parseInt(bridgeTransferEvent.args.networkId)).to.equal(2);
    });

    it("Claim a fungible token that was transfered", async function () {
      const [owner] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("BridgeDeployable");
      const bridge = await Bridge.deploy();
      await bridge.deployed();

      // Initialzie bridge
      await bridge.initialize(owner.address);

      await mockERC1155.mint(bridge.address, 5, 100, "0x");

      // Claim token
      const claimTx = await bridge.bridgeClaimMixedFungible(
        mockERC1155.address,
        owner.address,
        5,
        100
      );
      const tx = await claimTx.wait();
      // @ts-ignore
      expect(tx.events.length).to.equal(2);
      // @ts-ignore
      const bridgeClaimEvent = tx.events[1]; // @ts-ignore
      expect(bridgeClaimEvent.args.from).to.equal(owner.address); // @ts-ignore
      expect(bridgeClaimEvent.args.token).to.equal(mockERC1155.address); // @ts-ignore
      expect(parseInt(bridgeClaimEvent.args.tokenId)).to.equal(5); // @ts-ignore
      expect(parseInt(bridgeClaimEvent.args.amount)).to.equal(100); // @ts-ignore
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

    before(function () {
      const abi = new ethers.utils.AbiCoder();

      decodedMessage = {
        types: ["string", "uint256"],
        data: ["This is a message", "17"], // 17 is the length of the message
      };

      encodedMessage = abi.encode(decodedMessage.types, decodedMessage.data);

      hardFailMessage = abi.encode(["string"], ["FAIL"]);
      softFailMessage = abi.encode(["string"], ["fail"]);
    });

    beforeEach(async function () {
      mockMessageReceiver = await ethers.getContractFactory(
        "MessageReceiverMock"
      );
      mockMessageReceiver = await mockMessageReceiver.deploy();

      mockMessageReceiver.setHardFail(hardFailMessage, true);
      mockMessageReceiver.setSoftFail(softFailMessage, true);
    });

    it("Send an arbitrary message to another network", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("BridgeDeployable");
      const bridge = await Bridge.deploy();
      await bridge.deployed();

      // Initialzie bridge
      await bridge.initialize(owner.address);

      const messageTx = await bridge.sendMessage(
        1, // Message ID
        100, // Destination Network
        addr1.address, // Recipient
        false, // Request delivery receipt
        // @ts-ignore
        encodedMessage, // Message
        "0x" // Extra data
      );

      const tx = await messageTx.wait();
      // @ts-ignore
      expect(tx.events.length).to.equal(1);
      // @ts-ignore
      const messageSendEvent = tx.events[0]; // @ts-ignore
      expect(messageSendEvent.args.from).to.equal(owner.address); // @ts-ignore
      expect(parseInt(messageSendEvent.args.messageId)).to.equal(1); // @ts-ignore
      expect(parseInt(messageSendEvent.args.destination)).to.equal(100); // @ts-ignore
      expect(messageSendEvent.args.recipient).to.equal(addr1.address); // @ts-ignore
      expect(messageSendEvent.args.receipt).to.equal(false); // @ts-ignore
      expect(messageSendEvent.args.message).to.equal(encodedMessage); // @ts-ignore
    });

    it("Send an arbitrary message broadcast", async function () {
      const [owner] = await ethers.getSigners();
      const Bridge = await ethers.getContractFactory("BridgeDeployable");
      const bridge = await Bridge.deploy();
      await bridge.deployed();

      // Initialzie bridge
      await bridge.initialize(owner.address);

      const broadcastTx = await bridge.sendBroadcast(
        1, // Message ID
        false, // Request delivery receipt
        // @ts-ignore
        encodedMessage, // Message
        "0x" // Extra data
      );

      const tx = await broadcastTx.wait();
      // @ts-ignore
      expect(tx.events.length).to.equal(1);
      // @ts-ignore
      const messageSendEvent = tx.events[0]; // @ts-ignore
      expect(messageSendEvent.args.from).to.equal(owner.address); // @ts-ignore
      expect(parseInt(messageSendEvent.args.messageId)).to.equal(1); // @ts-ignore
      expect(messageSendEvent.args.receipt).to.equal(false); // @ts-ignore
      expect(messageSendEvent.args.message).to.equal(encodedMessage);
    });

    it("Simulate receiving a message", async function () {
      const [owner] = await ethers.getSigners();
      const Bridge = await ethers.getContractFactory("BridgeDeployable");
      const bridge = await Bridge.deploy();
      await bridge.deployed();

      // Initialzie bridge
      await bridge.initialize(owner.address);

      const relayTx = await bridge.relayMessage(
        mockMessageReceiver.address, // Recipient
        1, // MessageId
        owner.address, // Sender
        100, // From network
        true, // Request receipt
        softFailMessage // Message
      );

      const tx = await relayTx.wait();
      // @ts-ignore
      expect(tx.events.length).to.equal(1);
      // @ts-ignore
      const messageReceiveEvent = tx.events[0]; // @ts-ignore
      expect(messageReceiveEvent.args.from).to.equal(owner.address); // @ts-ignore
      expect(messageReceiveEvent.args.fromNetworkId).to.equal(100); // @ts-ignore
      expect(messageReceiveEvent.args.receiver).to.equal(
        mockMessageReceiver.address
      ); // @ts-ignore
      expect(messageReceiveEvent.args.success).to.equal(false); // @ts-ignore
      expect(messageReceiveEvent.args.messageId).to.equal(1); // @ts-ignore
      expect(messageReceiveEvent.args.receipt).to.equal(true);
    });
  });
});
