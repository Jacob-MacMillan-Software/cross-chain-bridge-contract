//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./IBridgeNonFungible.sol";
import "./IBridgeMixedFungible.sol";
import "./Controllable.sol";
import "./IERC721Bridgable.sol";
import "./IERC1155Bridgable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";

contract Bridge is IBridgeNonFungible, IBridgeMixedFungible, Controllable, ERC1155HolderUpgradeable {
	/**
	 * @notice Stores how many of each token each user has a claim to
	 * mapping is as follows: user's address => token contract address => amount of token
	 */
	mapping (address => mapping (address => uint256)) public fungibleClaims; 

	/**
	 * @notice Stores how many of each token each user has a claim to
	 * mapping is as follows: user's address => token contract address => tokenId => has the token or not
	 */
	mapping (address => mapping (address => mapping (uint256 => bool))) public nonFungibleClaims; 

	/**
	 * @notice Stores how many of each token each user has a claim to
	 * mapping is as follows: user's address => token contract address => tokenId => amount of token
	 */
	mapping (address => mapping (address => mapping (uint256 => uint256))) public mixedFungibleClaims; 



	function initialize(address _controller) public virtual override initializer {
		Controllable.initialize(_controller);
		ERC1155HolderUpgradeable.__ERC1155Holder_init();
	}

	/**
	 * @dev Returns the chainId of the network this contract is deployed on
	 */
	function chainId() public view returns (uint256) {
		uint256 id;
		assembly {
			id := chainid()
		}
		return id;
	}

	/**
	 * @dev Transfers an ERC20 token to a different chain
	 * This function simply moves the caller's tokens to this contract, and emits a `TokenTransferFungible` event
	 */
	function transferFungible(address token, uint256 amount, uint256 networkId) external virtual override {
		// require(networkId != chainId(), "Same chainId");

		IERC20Upgradeable(token).transferFrom(_msgSender(), address(this), amount);

		emit TokenTransferFungible(_msgSender(), token, amount, networkId);
	}

	/**
	 * @dev Claim a token that was transfered from another network
	 * Sends the caller the specified token, if they have a valid claim to the token
	 * MUST emit a `TokenClaimedFungible` event on success
	 */
	function claimFungible(address token, uint256 amount) external virtual override {
		require(fungibleClaims[_msgSender()][token] >= amount, "Insufficient claimable tokens");
		require(IERC20Upgradeable(token).balanceOf(address(this)) >= amount, "Insufficient liquidity");

		fungibleClaims[_msgSender()][token] -= amount;

		IERC20Upgradeable(token).transfer(_msgSender(), amount);

		emit TokenClaimedFungible(_msgSender(), token, amount);
	}

	/**
	 * @dev Used by the bridge network to add a claim to an ERC20 token
	 */
	function addClaimFungible(address token, address to, uint256 amount) external virtual override onlyController {
		fungibleClaims[to][token] += amount;
	}

	/**
	 * @dev Used by the bridge network to add multiple claims to an ERC20 token
	 */
	function addClaimFungibleBatch(address[] calldata tokens, address[] calldata tos, uint256[] calldata amounts) external virtual override onlyController {
		require(tokens.length == tos.length, "Array size mismatch");
		require(tos.length == amounts.length, "Array size mismatch");

		for(uint256 i = 0; i < tos.length; i++) {
			fungibleClaims[tos[i]][tokens[i]] += amounts[i];
		}
	}

	/**
	 * @dev Transfers an ERC721 token to a different chain
	 * This function simply moves the caller's tokens to this contract, and emits a `TokenTransferNonFungible` event
	 */
	function transferNonFungible(address token, uint256 tokenId, uint256 networkId) external virtual override {
		// require(networkId != chainId(), "Same chainId");

		IERC721Upgradeable(token).transferFrom(_msgSender(), address(this), tokenId);

		emit TokenTransferNonFungible(_msgSender(), token, tokenId, networkId);
	}

	/**
	* @dev Claim a token that was transfered from another network
	* Sends the caller the specified token, if they have a valid claim to the token
		* MUST emit a `TokenClaimedFungible` event on success
	*/
	function claimNonFungible(address token, uint256 tokenId) external virtual override {
		require(nonFungibleClaims[_msgSender()][token][tokenId], "Insufficient claimable tokens");

		nonFungibleClaims[_msgSender()][token][tokenId] = false;

		// Check if the token needs to be minted
		// If it does, attempt to mint it (will fail if this contract has no such permission, or the ERC721 contract doesn't support bridgeMint)
		// If the token exists, and the owner is this contract, it will be sent like normal
		// Otherwise this contract will revert
		if(IERC721Bridgable(token).ownerOf(tokenId) == address(0)) {
			IERC721Bridgable(token).bridgeMint(_msgSender(), tokenId);
		} else {
			IERC721Bridgable(token).transferFrom(address(this), _msgSender(), tokenId);
		}

		emit TokenClaimedNonFungible(_msgSender(), token, tokenId);
	}

	/**
	* @dev Used by the bridge network to add a claim to an ERC721 token
	*/
	function addClaimNonFungible(address token, address to, uint256 tokenId) external virtual override onlyController {
		nonFungibleClaims[to][token][tokenId] = true;
	}

	/**
	* @dev Used by the bridge network to add multiple claims to an ERC721 token
	 */
	function addClaimNonFungibleBatch(address[] calldata tokens, address[] calldata tos, uint256[] calldata tokenIds) external virtual override onlyController {
		require(tokens.length == tos.length, "Array size mismatch");
		require(tos.length == tokenIds.length, "Array size mismatch");

		for(uint256 i = 0; i < tos.length; i++) {
			nonFungibleClaims[tos[i]][tokens[i]][tokenIds[i]] = true;
		}
	}

	/**
	* @dev Transfers an ERC1155 token to a different chain
	* This function simply moves the caller's tokens to this contract, and emits a `TokenTransferMixedFungible` event
	 */
	function transferMixedFungible(address token, uint256 tokenId, uint256 amount, uint256 networkId) external virtual override {
		// require(networkId != chainId(), "Same chainId");

		IERC1155Upgradeable(token).safeTransferFrom(_msgSender(), address(this), tokenId, amount, toBytes(0));

		emit TokenTransferMixedFungible(_msgSender(), token, tokenId, amount, networkId);
	}

	/**
	* @dev Claim a token that was transfered from another network
	* Sends the caller the specified token, if they have a valid claim to the token
	* MUST emit a `TokenClaimedMixedFungible` event on success
	 */
	function claimMixedFungible(address token, uint256 tokenId, uint256 amount) external virtual override {
		require(mixedFungibleClaims[_msgSender()][token][tokenId] >= amount, "Insufficient claimable tokens");

		mixedFungibleClaims[_msgSender()][token][tokenId] -= amount;

		// Get balance of tokens that this contract owns, mint the rest
		uint256 balance = IERC1155Bridgable(token).balanceOf(address(this), tokenId);
		uint256 balanceToMint = 0;

		if(balance < amount) {
			balanceToMint = amount - balance;
		}

		IERC1155Bridgable(token).safeTransferFrom(address(this), _msgSender(), tokenId, amount, toBytes(0));

		if(balanceToMint > 0) {
			IERC1155Bridgable(token).bridgeMint(_msgSender(), tokenId, amount);
		}

		emit TokenClaimedMixedFungible(_msgSender(), token, tokenId, amount);
	}

	/**
	* @dev Used by the bridge network to add a claim to an ERC1155 token
	 */
	function addClaimMixedFungible(address token, address to, uint256 tokenId, uint256 amount) external virtual override onlyController {
		mixedFungibleClaims[to][token][tokenId] += amount;
	}

	/**
	 * @dev Used by the bridge network to add multiple claims to an ERC1155 token
	 */
	function addClaimMixedFungibleBatch(address[] calldata tokens, address[] calldata tos, uint256[] calldata tokenIds, uint256[] calldata amounts) external virtual override onlyController {
		require(tokens.length == tos.length, "Array size mismatch");
		require(tos.length == tokenIds.length, "Array size mismatch");
		require(tokenIds.length == amounts.length, "Array size mismatch");

		for(uint256 i = 0; i < tos.length; i++) {
			mixedFungibleClaims[tos[i]][tokens[i]][tokenIds[i]] += amounts[i];
		}
	}


	function toBytes(uint256 x) private pure returns (bytes memory b) {
		b = new bytes(32);
		assembly { mstore(add(b, 32), x) }
	}
}
