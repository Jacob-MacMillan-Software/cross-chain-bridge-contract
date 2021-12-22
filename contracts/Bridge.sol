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

	function __init_bridge(address _controller) internal virtual initializer {
		Controllable.__init_controller(_controller);
		ERC1155HolderUpgradeable.__ERC1155Holder_init();
	}

	/**
	 * @dev Returns the chainId of the network this contract is deployed on
	 */
	/*function chainId() public view returns (uint256) {
		uint256 id;
		assembly {
			id := chainid()
		}
		return id;
	}*/

	/**
	 * @dev Transfers an ERC20 token to a different chain
	 * This function simply moves the caller's tokens to this contract, and emits a `TokenTransferFungible` event
	 */
	function transferFungible(
		address token,
		uint256 amount,
		uint256 networkId,
		bytes calldata
	) external virtual override {
		_transferFungible(token, amount, networkId);
	}

	/**
	 * @dev Used by bridge network to transfer the item directly to user without need for manual claiming
	 */
	function bridgeClaimFungible(
		address _token,
		address _to,
		uint256 _amount
	) external virtual override onlyController {
		require(IERC20Upgradeable(_token).balanceOf(address(this)) >= _amount, "Insufficient liquidity");

		IERC20Upgradeable(_token).transfer(_to, _amount);

		emit TokenClaimedFungible(_to, _token, _amount);
	}

	/**
	 * @dev Transfers an ERC721 token to a different chain
	 * This function simply moves the caller's tokens to this contract, and emits a `TokenTransferNonFungible` event
	 */
	function transferNonFungible(
		address _token,
		uint256 _tokenId,
		uint256 _networkId,
		bytes calldata
	) external virtual override {
		_transferNonFungible(_token, _tokenId, _networkId);
	}

	/**
	 * @dev Used by bridge network to transfer the item directly to user without need for manual claiming
	 */
	function bridgeClaimNonFungible(
		address _token,
		address _to,
		uint256 _tokenId
	) external virtual override onlyController {
		address tokenOwner;
		// The try-catch block is because `ownerOf` can (and I think is supposed to) revert if the item doesn't yet exist on this chain
		try IERC721Bridgable(_token).ownerOf(_tokenId) returns (address owner) {
			tokenOwner = owner;
		} catch {
			tokenOwner = address(0);
		}

		// Check if the token needs to be minted
		// If it does, attempt to mint it (will fail if this contract has no such permission, or the ERC721 contract doesn't support bridgeMint)
		// If the token exists, and the owner is this contract, it will be sent like normal
		// Otherwise this contract will revert
		if(tokenOwner == address(0)) {
			IERC721Bridgable(_token).bridgeMint(_msgSender(), _tokenId);
		} else {
			// This will revert if the bridge does not own the token; this is intended
			IERC721Bridgable(_token).transferFrom(address(this), _to, _tokenId);
		}

		emit TokenClaimedNonFungible(_to, _token, _tokenId);
	}

	/**
	* @dev Transfers an ERC1155 token to a different chain
	* This function simply moves the caller's tokens to this contract, and emits a `TokenTransferMixedFungible` event
	*/
	function transferMixedFungible(
		address _token,
		uint256 _tokenId,
		uint256 _amount,
		uint256 _networkId,
		bytes calldata
	) external virtual override {
		_transferMixedFungible(_token, _tokenId, _amount, _networkId);
	}

	/**
	* @dev Used by bridge network to transfer the item directly to user without need for manual claiming
	*/
	function bridgeClaimMixedFungible(
		address token,
		address to,
		uint256 tokenId,
		uint256 amount
	) external virtual override onlyController {
		// Get balance of tokens that this contract owns, mint the rest
		uint256 balance = IERC1155Bridgable(token).balanceOf(address(this), tokenId);
		uint256 balanceToMint = 0;
		uint256 balanceToTransfer = amount;

		if(balance < amount) {
			balanceToMint = amount - balance;
			balanceToTransfer = balance;
		}

		IERC1155Bridgable(token).safeTransferFrom(address(this), to, tokenId, balanceToTransfer, toBytes(0));

		if(balanceToMint > 0) {
			IERC1155Bridgable(token).bridgeMint(to, tokenId, balanceToMint);
		}

		emit TokenClaimedMixedFungible(to, token, tokenId, amount);
	}

	function toBytes(uint256 x) internal pure returns (bytes memory b) {
		b = new bytes(32);
		assembly { mstore(add(b, 32), x) }
	}

	function _transferFungible(address token, uint256 amount, uint256 networkId) internal {
		// require(networkId != chainId(), "Same chainId");

		IERC20Upgradeable(token).transferFrom(_msgSender(), address(this), amount);

		emit TokenTransferFungible(_msgSender(), token, amount, networkId);
	}

	function _transferNonFungible(address _token, uint256 _tokenId, uint256 _networkId) internal {
		// require(networkId != chainId(), "Same chainId");

		IERC721Upgradeable(_token).transferFrom(_msgSender(), address(this), _tokenId);

		emit TokenTransferNonFungible(_msgSender(), _token, _tokenId, _networkId);
	}

	function _transferMixedFungible(
		address _token,
		uint256 _tokenId,
		uint256 _amount,
		uint256 _networkId
	) internal {
		// require(networkId != chainId(), "Same chainId");

		IERC1155Upgradeable(_token).safeTransferFrom(_msgSender(), address(this), _tokenId, _amount, toBytes(0));

		emit TokenTransferMixedFungible(_msgSender(), _token, _tokenId, _amount, _networkId);
	}
}
