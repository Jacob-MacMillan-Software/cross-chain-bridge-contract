//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./IMessageReceiver.sol";

/**
 * @dev Interface for receiving message sent receipts from bridge
 */
interface IMessageReceiverWithReceipt is IMessageReceiver {

	// MUST only be callable by bridge network
	function messageReceipt(
		uint256 messageId,
		uint256 fromNetworkId,
		bool success
	) external;
}
