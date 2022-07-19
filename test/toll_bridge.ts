import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
// eslint-disable-next-line node/no-missing-import
import { generateFeeData } from "./helpers/messageSigning";

const ERC20Mock = require("../artifacts/contracts/mocks/ERC20Mock.sol/ERC20Mock.json");
const ERC721Mock = require("../artifacts/contracts/mocks/ERC721Mock.sol/ERC721Mock.json");
const ERC1155Mock = require("../artifacts/contracts/mocks/ERC1155Mock.sol/ERC1155Mock.json");
const MessageReceiverMock = require("../artifacts/contracts/mocks/MessageReceiverMock.sol/MessageReceiverMock.json");

describe("Toll Bridge", function () {
  const zeroAddress = "0x0000000000000000000000000000000000000000";
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

  describe("ERC20 bridge", function () {
    let mockERC20: typeof ERC20Mock;

    beforeEach(async function () {
      const [owner] = await ethers.getSigners();

      mockERC20 = await ethers.getContractFactory("ERC20Mock");
      mockERC20 = await mockERC20.deploy("Test", "TST");

      await mockERC20.mint(owner.address, "100000000000000000000");
    });

    it("Transfer a fungilbe token to another network with no fee", async function () {
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
        fakeFeeTokenAddr,
        0,
        noExpireBlock,
        { tokenAddr: mockERC20.address, tokenAmount: 100 },
        null,
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

      expect(tx.events.length).to.equal(3);

      const bridgeTxEvent = tx.events[2];
      expect(bridgeTxEvent.args.from).to.equal(owner.address);
      expect(bridgeTxEvent.args.token).to.equal(mockERC20.address);
      expect(parseInt(bridgeTxEvent.args.amount)).to.equal(100);
      expect(parseInt(bridgeTxEvent.args.networkId)).to.equal(2);
    });

    it("Claim a fungible token that was transfered", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        tollToken.address,
        1,
      ]);
      await bridge.deployed();

      await mockERC20.mint(bridge.address, 100);

      // Claim token
      const claimTx = await bridge.bridgeClaimFungible(
        mockERC20.address,
        addr1.address,
        100
      );
      const tx = await claimTx.wait();

      expect(tx.events.length).to.equal(2);

      const bridgeClaimEvent = tx.events[1];
      expect(bridgeClaimEvent.args.from).to.equal(addr1.address);
      expect(bridgeClaimEvent.args.token).to.equal(mockERC20.address);
      expect(parseInt(bridgeClaimEvent.args.amount)).to.equal(100);
    });

    it("Transfer a fungilbe token to another network with fee paid in ERC-20", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
        1,
      ]);
      await bridge.deployed();

      await tollToken.approve(bridge.address, 0xffffffffff);
      await mockERC20.approve(bridge.address, 0xffffffffff);

      const pendingFeeBefore = await bridge.pendingFees(tollToken.address);

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

      const transferTx = await bridge.transferFungible(
        mockERC20.address,
        100,
        2,
        feeData
      );
      const tx = await transferTx.wait();

      expect(tx.events.length).to.equal(5); // Approval, transfer x2, bridge transfer

      // Only bridge transfer event has e?.args for some reason
      const bridgeTxEvent = tx.events[2];
      expect(bridgeTxEvent.args.from).to.equal(owner.address);
      expect(bridgeTxEvent.args.token).to.equal(mockERC20.address);
      expect(parseInt(bridgeTxEvent.args.amount)).to.equal(100);
      expect(parseInt(bridgeTxEvent.args.networkId)).to.equal(2);

      const pendingFeeAfter = await bridge.pendingFees(tollToken.address);

      expect(pendingFeeAfter.sub(pendingFeeBefore)).to.equal(feeAmount);
    });

    it("Transfer a fungilbe token to another network with fee paid in ETH", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
        1,
      ]);
      await bridge.deployed();

      await mockERC20.approve(bridge.address, 0xffffffffff);

      const pendingFeeBefore = await bridge.pendingFees(zeroAddress);

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

      expect(tx.events.length).to.equal(3);

      const bridgeTxEvent = tx.events[2];
      expect(bridgeTxEvent.args.from).to.equal(owner.address);
      expect(bridgeTxEvent.args.token).to.equal(mockERC20.address);
      expect(parseInt(bridgeTxEvent.args.amount)).to.equal(100);
      expect(parseInt(bridgeTxEvent.args.networkId)).to.equal(2);

      const pendingFeeAfter = await bridge.pendingFees(zeroAddress);

      expect(pendingFeeAfter.sub(pendingFeeBefore)).to.equal(feeAmount);
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

    it("Transfer a non-fungilbe token to another network with no fee", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
        1,
      ]);
      await bridge.deployed();

      await mockERC721.setApprovalForAll(bridge.address, true);

      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        2,
        tollToken.address,
        0,
        noExpireBlock,
        { tokenAddr: mockERC721.address, tokenId: 1 },
        null,
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

      expect(tx.events.length).to.equal(3);

      const bridgeTransferEvent = tx.events[2];
      expect(bridgeTransferEvent.args.from).to.equal(owner.address);
      expect(bridgeTransferEvent.args.token).to.equal(mockERC721.address);
      expect(parseInt(bridgeTransferEvent.args.tokenId)).to.equal(1);
      expect(parseInt(bridgeTransferEvent.args.networkId)).to.equal(2);
    });

    it("Claim a non-fungible token that was transfered and the NFT exist and is owned by bridge contract", async function () {
      const [owner] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        tollToken.address,
        1,
      ]);
      await bridge.deployed();

      await mockERC721.mint(bridge.address, 101);

      // Claim token
      const claimTx = await bridge.bridgeClaimNonFungible(
        mockERC721.address,
        owner.address,
        101
      );
      const tx = await claimTx.wait();

      expect(tx.events.length).to.equal(3);

      const bridgeClaimEvent = tx.events[2];
      expect(bridgeClaimEvent.args.from).to.equal(owner.address);
      expect(bridgeClaimEvent.args.token).to.equal(mockERC721.address);
      expect(parseInt(bridgeClaimEvent.args.tokenId)).to.equal(101);
    });

    it("Claim a non-fungible token that was transfered and the NFT does not exist", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
        1,
      ]);
      await bridge.deployed();

      // Claim token
      const claimTx = await bridge.bridgeClaimNonFungible(
        mockERC721.address,
        addr1.address,
        101
      );
      const tx = await claimTx.wait();

      expect(tx.events.length).to.equal(2);

      const bridgeClaimEvent = tx.events[1];
      expect(bridgeClaimEvent.args.from).to.equal(addr1.address);
      expect(bridgeClaimEvent.args.token).to.equal(mockERC721.address);
      expect(parseInt(bridgeClaimEvent.args.tokenId)).to.equal(101);

      const newOwner = await mockERC721.ownerOf(101);
      expect(newOwner).to.equal(addr1.address);
    });

    it("Transfer a non-fungilbe token to another network with fee in ERC-20", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
        1,
      ]);
      await bridge.deployed();

      await tollToken.approve(bridge.address, 0xffffffffff);
      await mockERC721.setApprovalForAll(bridge.address, true);

      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        2,
        tollToken.address,
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
        feeData
      );
      const tx = await transferTx.wait();

      expect(tx.events.length).to.equal(5);

      const bridgeTransferEvent = tx.events[2];
      expect(bridgeTransferEvent.args.from).to.equal(owner.address);
      expect(bridgeTransferEvent.args.token).to.equal(mockERC721.address);
      expect(parseInt(bridgeTransferEvent.args.tokenId)).to.equal(1);
      expect(parseInt(bridgeTransferEvent.args.networkId)).to.equal(2);
    });

    it("Transfer a non-fungilbe token to another network with fee in ETH", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
        1,
      ]);
      await bridge.deployed();

      await mockERC721.setApprovalForAll(bridge.address, true);

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

      expect(tx.events.length).to.equal(3);

      const bridgeTransferEvent = tx.events[2];
      expect(bridgeTransferEvent.args.from).to.equal(owner.address);
      expect(bridgeTransferEvent.args.token).to.equal(mockERC721.address);
      expect(parseInt(bridgeTransferEvent.args.tokenId)).to.equal(1);
      expect(parseInt(bridgeTransferEvent.args.networkId)).to.equal(2);
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

    it("Transfer a mixed fungilbe token to another network with no fee", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
        1,
      ]);
      await bridge.deployed();

      await mockERC1155.setApprovalForAll(bridge.address, true);

      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        2,
        tollToken.address,
        0,
        noExpireBlock,
        { tokenAddr: mockERC1155.address, tokenId: 1, tokenAmount: 100 },
        null,
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

      expect(tx.events.length).to.equal(2);

      const bridgeTransferEvent = tx.events[1];
      expect(bridgeTransferEvent.args.from).to.equal(owner.address);
      expect(bridgeTransferEvent.args.token).to.equal(mockERC1155.address);
      expect(parseInt(bridgeTransferEvent.args.tokenId)).to.equal(1);
      expect(parseInt(bridgeTransferEvent.args.amount)).to.equal(100);
      expect(parseInt(bridgeTransferEvent.args.networkId)).to.equal(2);
    });

    it("Transfer a mixed fungilbe token to another network with fee in ERC-20", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
        1,
      ]);
      await bridge.deployed();

      await tollToken.approve(bridge.address, 0xffffffffff);
      await mockERC1155.setApprovalForAll(bridge.address, true);

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

      const transferTx = await bridge.transferMixedFungible(
        mockERC1155.address,
        1,
        100,
        2,
        feeData
      );

      const tx = await transferTx.wait();

      expect(tx.events.length).to.equal(4);

      const bridgeTransferEvent = tx.events[1];
      expect(bridgeTransferEvent.args.from).to.equal(owner.address);
      expect(bridgeTransferEvent.args.token).to.equal(mockERC1155.address);
      expect(parseInt(bridgeTransferEvent.args.tokenId)).to.equal(1);
      expect(parseInt(bridgeTransferEvent.args.amount)).to.equal(100);
      expect(parseInt(bridgeTransferEvent.args.networkId)).to.equal(2);
    });

    it("Transfer a mixed fungilbe token to another network with fee in ETH", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
        1,
      ]);
      await bridge.deployed();

      await mockERC1155.setApprovalForAll(bridge.address, true);

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

      expect(tx.events.length).to.equal(2);

      const bridgeTransferEvent = tx.events[1];
      expect(bridgeTransferEvent.args.from).to.equal(owner.address);
      expect(bridgeTransferEvent.args.token).to.equal(mockERC1155.address);
      expect(parseInt(bridgeTransferEvent.args.tokenId)).to.equal(1);
      expect(parseInt(bridgeTransferEvent.args.amount)).to.equal(100);
      expect(parseInt(bridgeTransferEvent.args.networkId)).to.equal(2);
    });

    it("Claim a mixed fungible token that was transfered", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
        1,
      ]);
      await bridge.deployed();

      await mockERC1155.mint(bridge.address, 5, 100, "0x");

      // Claim token
      const claimTx = await bridge.bridgeClaimMixedFungible(
        mockERC1155.address,
        addr1.address,
        5,
        100
      );
      const tx = await claimTx.wait();

      expect(tx.events.length).to.equal(2);

      const bridgeClaimEvent = tx.events[1];
      expect(bridgeClaimEvent.args.from).to.equal(addr1.address);
      expect(bridgeClaimEvent.args.token).to.equal(mockERC1155.address);
      expect(parseInt(bridgeClaimEvent.args.tokenId)).to.equal(5);
      expect(parseInt(bridgeClaimEvent.args.amount)).to.equal(100);
    });

    it("Claim a mixed fungible token that was transfered and the NFT does not exist", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
        1,
      ]);
      await bridge.deployed();

      await mockERC1155.mint(bridge.address, 2, 100, "0x");

      // Claim token
      const claimTx = await bridge.bridgeClaimMixedFungible(
        mockERC1155.address,
        addr1.address,
        5,
        100
      );
      const tx = await claimTx.wait();

      expect(tx.events.length).to.equal(3);

      const bridgeClaimEvent = tx.events[2];
      expect(bridgeClaimEvent.args.from).to.equal(addr1.address);
      expect(bridgeClaimEvent.args.token).to.equal(mockERC1155.address);
      expect(parseInt(bridgeClaimEvent.args.tokenId)).to.equal(5);
      expect(parseInt(bridgeClaimEvent.args.amount)).to.equal(100);
    });

    it("Claim a mixed fungible token that was transfered and not enough of the NFTs exist", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
        1,
      ]);
      await bridge.deployed();

      // Claim token
      const claimTx = await bridge.bridgeClaimMixedFungible(
        mockERC1155.address,
        addr1.address,
        5,
        100
      );
      const tx = await claimTx.wait();

      expect(tx.events.length).to.equal(3);

      const bridgeClaimEvent = tx.events[2];
      expect(bridgeClaimEvent.args.from).to.equal(addr1.address);
      expect(bridgeClaimEvent.args.token).to.equal(mockERC1155.address);
      expect(parseInt(bridgeClaimEvent.args.tokenId)).to.equal(5);
      expect(parseInt(bridgeClaimEvent.args.amount)).to.equal(100);
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

    it("Send an arbitrary message to another network with ERC-20 fee", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
        1,
      ]);
      await bridge.deployed();

      await tollToken.approve(bridge.address, 0xffffffffff);

      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        100,
        tollToken.address,
        feeAmount,
        noExpireBlock,
        { tokenAddr: addr1.address },
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
        encodedMessage, // Message
        feeData
      );

      const tx = await messageTx.wait();

      expect(tx.events.length).to.equal(3);

      const messageSendEvent = tx.events[0];
      expect(messageSendEvent.args.from).to.equal(owner.address);
      expect(parseInt(messageSendEvent.args.messageId)).to.equal(1);
      expect(parseInt(messageSendEvent.args.destination)).to.equal(100);
      expect(messageSendEvent.args.recipient).to.equal(addr1.address);
      expect(messageSendEvent.args.receipt).to.equal(false);
      expect(messageSendEvent.args.message).to.equal(encodedMessage);
    });

    it("Send an arbitrary message to another network with ETH fee", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
        1,
      ]);
      await bridge.deployed();

      // Generate fee verification
      const feeData = await generateFeeData(
        owner.address,
        100,
        zeroAddress,
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
        feeData,
        { value: feeAmount }
      );

      const tx = await messageTx.wait();

      expect(tx.events.length).to.equal(1);

      const messageSendEvent = tx.events[0];
      expect(messageSendEvent.args.from).to.equal(owner.address);
      expect(parseInt(messageSendEvent.args.messageId)).to.equal(1);
      expect(parseInt(messageSendEvent.args.destination)).to.equal(100);
      expect(messageSendEvent.args.recipient).to.equal(addr1.address);
      expect(messageSendEvent.args.receipt).to.equal(false);
      expect(messageSendEvent.args.message).to.equal(encodedMessage);
    });

    it("Send an arbitrary message broadcast with ERC-20 fee", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
        1,
      ]);
      await bridge.deployed();

      await tollToken.approve(bridge.address, 0xffffffffff);

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
        addr1,
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
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
        1,
      ]);
      await bridge.deployed();

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
        addr1,
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

    it("Simulate receiving a message", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
        1,
      ]);
      await bridge.deployed();

      const relayTx = await bridge.relayMessage(
        mockMessageReceiver.address, // Recipient
        1, // MessageId
        owner.address, // Sender
        100, // From network
        true, // Request receipt
        hardFailMessage // Message
      );

      const tx = await relayTx.wait();

      expect(tx.events.length).to.equal(1);

      const messageReceiveEvent = tx.events[0];
      expect(messageReceiveEvent.args.from).to.equal(owner.address);
      expect(messageReceiveEvent.args.fromNetworkId).to.equal(100);
      expect(messageReceiveEvent.args.receiver).to.equal(
        mockMessageReceiver.address
      );
      expect(messageReceiveEvent.args.success).to.equal(false);
      expect(messageReceiveEvent.args.messageId).to.equal(1);
      expect(messageReceiveEvent.args.receipt).to.equal(true);
    });
  });
});
