//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

/**
 * @dev Interface for bridge contract
 */
interface IBridge {
	/**
	 * @dev Transfers an ERC20 token to a different chain
	 * This function simply moves the caller's tokens to this contract, and emits a `TokenTransferFungible` event
	 */
	function transferFungible(address token, uint256 amount, uint256 networkId, bytes calldata data) external;

	/**
	 * @dev Used by the bridge relay to 'transfer' a user's item to the chain
	 */
	function bridgeClaimFungible(address token, address to, uint256 amount) external;

	/**
	 * @dev Used to send arbitrary messages to other networks
	 * MUST emit `MessageSent` event
	 */
	function sendMessage(
		uint256 messageId,
		uint256 destination,
		string calldata recipient,
		bool receipt,
		bytes calldata message,
		bytes calldata data
	) external;

	/**
	 * @dev Used to send arbitrary messages to all other contracts within the same project as sender
	 * MUST emit `BroadcastSent` event
	 */
	function sendBroadcast(
		uint256 messageId,
		bool receipt,
		bytes calldata message,
		bytes calldata data
	) external;

	/**
	 * @dev Relay message from another network. MUST only be callable by bridge network
	 * MUST emit `MessageReceived` event
	 */
	function relayMessage(
		address recipient,
		uint256 messageId,
		string calldata sender,
		uint256 fromNetworkId,
		bytes calldata message
	) external returns (bool);

	event MessageSent(
		address indexed from,
		uint256 indexed messageId,
		uint256 destination,
		string recipient,
		bool receipt,
		bytes message
	);
	event BroadcastSent(
		address indexed from,
		uint256 indexed messageId,
		bool receipt,
		bytes message
	);
	event MessageReceived(
		address indexed receiver,
		string from,
		bool success,
		uint256 messageId
	);

	event TokenTransferFungible(address indexed from, address indexed token, uint256 amount, uint256 networkId);
	event TokenClaimedFungible(address indexed from, address indexed token, uint amount);
}
