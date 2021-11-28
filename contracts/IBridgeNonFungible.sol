//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./IBridge.sol";

/**
 * @dev Interface for bridge contract with added support for NonFungible tokens that follow the ERC-721 standard
 */
interface IBridgeNonFungible is IBridge {
	/**
	 * @dev Transfers an ERC721 token to a different chain
	 * This function simply moves the caller's tokens to this contract, and emits a `TokenTransferFungible` event
	 */
	function transferNonFungible(address token, uint256 tokenId, uint256 networkId) external;

	/**
	 * @dev Claim a token that was transfered from another network
	 * Sends the caller the specified token, if they have a valid claim to the token
	 * MUST emit a `TokenClaimedFungible` event on success
	 */
	function claimNonFungible(address token, uint256 tokenId) external;

	/**
	 * @dev Used by the bridge network to add a claim to an ERC721 token
	 */
	function addClaimNonFungible(address token, address to, uint256 tokenId) external;

	/**
	 * @dev Used by the bridge network to add multiple claims to an ERC721 token
	 */
	function addClaimNonFungibleBatch(address[] calldata tokens, address[] calldata tos, uint256[] calldata tokenIds) external;

	event TokenTransferNonFungible(address indexed from, address indexed token, uint256 tokenId, uint256 networkId);
	event TokenClaimedNonFungible(address indexed from, address indexed token, uint256 tokenId);
}
