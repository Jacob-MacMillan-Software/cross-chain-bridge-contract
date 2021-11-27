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
	function transferFungible(address token, uint256 amount, uint256 networkId) external;

	/**
	 * @dev Claim a token that was transfered from another network
	 * Sends the caller the specified token, if they have a valid claim to the token
	 * MUST emit a `TokenClaimedFungible` event on success
	 */
	function claimFungible(address token, uint256 amount) external;

	/**
	 * @dev Used by the bridge network to add a claim to an ERC20 token
	 */
	function addClaimFungible(address token, address to, uint256 amount) external;
	
	/**
	 * @dev Used by the bridge network to add multiple claims to an ERC20 token
	 */
	function addClaimFungibleBatch(address[] calldata tokens, address[] calldata tos, uint256[] calldata amounts) external;

	event TokenTransferFungible(address indexed from, address indexed token, uint256 amount, uint256 networkId);
	event TokenClaimedFungible(address indexed from, address indexed token, uint amount);
}
