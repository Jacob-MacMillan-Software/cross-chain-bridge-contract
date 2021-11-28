//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./IBridge.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155ReceiverUpgradeable.sol";

/**
 * @dev Interface for bridge contract with added support for MixedFungible tokens that follow the ERC-1155 standard
 */
interface IBridgeMixedFungible is IBridge, IERC1155ReceiverUpgradeable {
	/**
	 * @dev Transfers an ERC1155 token to a different chain
	 * This function simply moves the caller's tokens to this contract, and emits a `TokenTransferMixedFungible` event
	 */
	function transferMixedFungible(address token, uint256 tokenId, uint256 amount, uint256 networkId) external;

	/**
	 * @dev Claim a token that was transfered from another network
	 * Sends the caller the specified token, if they have a valid claim to the token
	 * MUST emit a `TokenClaimedMixedFungible` event on success
	 */
	function claimMixedFungible(address token, uint256 tokenId, uint256 amount) external;

	/**
	 * @dev Used by the bridge network to add a claim to an ERC1155 token
	 */
	function addClaimMixedFungible(address token, address to, uint256 tokenId, uint256 amount) external;

	/**
	 * @dev Used by the bridge network to add multiple claims to an ERC1155 token
	 */
	function addClaimMixedFungibleBatch(address[] calldata tokens, address[] calldata tos, uint256[] calldata tokenIds, uint256[] calldata amounts) external;

	event TokenTransferMixedFungible(address indexed from, address indexed token, uint256 tokenId, uint256 amount, uint256 networkId);
	event TokenClaimedMixedFungible(address indexed from, address indexed token, uint256 tokenId, uint256 amount);
}
