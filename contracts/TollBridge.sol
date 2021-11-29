//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./Bridge.sol";

contract TollBridge is Bridge {

	/**
	 * @notice The ERC-20 token used to pay the bridge toll
	 */
	IERC20Upgradeable public tollToken;

	/**
	 * @notice Stores how much each user can be rebated
	 * Mapping from address to amount of tokens to rebate
	 */
	mapping (address => uint256) public availableRebates;

	// Toll fees
	uint256 public fungibleFee;
	uint256 public nonFungibleFee;
	uint256 public mixedFungibleFee;
	// Fees that have been paid and can be withdrawn from this contract
	uint256 public pendingFees;

	function initialize(address _controller, address _tollToken) public virtual initializer {
		tollToken = IERC20Upgradeable(_tollToken);
		Bridge.initialize(_controller);
	}

	/**
	 * @dev Pull the an amount of `tollToken` equal to `_fee` from the user's account to pay the bridge toll
	 */
	modifier requireToll(uint256 _fee) {
		_;

		// Do this last to avoid possible reentrancy attack
		tollToken.transferFrom(_msgSender(), address(this), _fee);
	}

	// Functions to adjust the fees
	function changeFungibleFee(uint256 _fee) external onlyController {
		fungibleFee = _fee;
	}

	function changeNonFungibleFee(uint256 _fee) external onlyController {
		nonFungibleFee = _fee;
	}

	function changeMixedFungibleFee(uint256 _fee) external onlyController {
		mixedFungibleFee = _fee;
	}

	/**
	 * @dev Transfers an ERC20 token to a different chain
	 * This function simply moves the caller's tokens to this contract, and emits a `TokenTransferFungible` event
	 */
	function transferFungible(address token, uint256 amount, uint256 networkId) external virtual override requireToll(fungibleFee) {
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

		_rebateFee(_msgSender());

		emit TokenClaimedFungible(_msgSender(), token, amount);
	}

	/**
	 * @dev Used by the bridge network to add a claim to an ERC20 token
	 */
	function addClaimFungibleWithFeeRebate(address token, address to, uint256 amount, uint256 feeRebate) external virtual onlyController {
		fungibleClaims[to][token] += amount;
		availableRebates[to] += feeRebate;
	}

	/**
	* @dev Used by the bridge network to add multiple claims to an ERC20 token
	*/
	function addClaimFungibleBatchWithFeeRebate(address[] calldata tokens, address[] calldata tos, uint256[] calldata amounts, uint256[] calldata feeRebates) external virtual onlyController {
		require(tokens.length == tos.length, "Array size mismatch");
		require(tos.length == amounts.length, "Array size mismatch");

		for(uint256 i = 0; i < tos.length; i++) {
			fungibleClaims[tos[i]][tokens[i]] += amounts[i];
			availableRebates[tos[i]] += feeRebates[i];
		}
	}

	/**
	* @dev Transfers an ERC721 token to a different chain
	* This function simply moves the caller's tokens to this contract, and emits a `TokenTransferNonFungible` event
	*/
	function transferNonFungible(address token, uint256 tokenId, uint256 networkId) external virtual override requireToll(nonFungibleFee) {
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

		_rebateFee(_msgSender());

		emit TokenClaimedNonFungible(_msgSender(), token, tokenId);
	}

	/**
	* @dev Used by the bridge network to add a claim to an ERC721 token
	*/
	function addClaimNonFungibleWithFeeRebate(address token, address to, uint256 tokenId, uint256 feeRebate) external virtual onlyController {
		nonFungibleClaims[to][token][tokenId] = true;
		availableRebates[to] += feeRebate;
	}

	/**
	* @dev Used by the bridge network to add multiple claims to an ERC721 token
	*/
	function addClaimNonFungibleBatchWithFeeRebates(address[] calldata tokens, address[] calldata tos, uint256[] calldata tokenIds, uint256[] calldata feeRebates) external virtual onlyController {
		require(tokens.length == tos.length, "Array size mismatch");
		require(tos.length == tokenIds.length, "Array size mismatch");

		for(uint256 i = 0; i < tos.length; i++) {
			nonFungibleClaims[tos[i]][tokens[i]][tokenIds[i]] = true;
			availableRebates[tos[i]] += feeRebates[i];
		}
	}

	/**
	* @dev Transfers an ERC1155 token to a different chain
	* This function simply moves the caller's tokens to this contract, and emits a `TokenTransferMixedFungible` event
	*/
	function transferMixedFungible(address token, uint256 tokenId, uint256 amount, uint256 networkId) external virtual override requireToll(mixedFungibleFee) {
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

		_rebateFee(_msgSender());

		emit TokenClaimedMixedFungible(_msgSender(), token, tokenId, amount);
	}

	/**
	* @dev Used by the bridge network to add a claim to an ERC1155 token
	*/
	function addClaimMixedFungibleWithFeeRebate(address token, address to, uint256 tokenId, uint256 amount, uint256 feeRebate) external virtual onlyController {
		mixedFungibleClaims[to][token][tokenId] += amount;
		availableRebates[to] += feeRebate;
	}

	/**
	* @dev Used by the bridge network to add multiple claims to an ERC1155 token
	*/
	function addClaimMixedFungibleBatchWithFeeRebate(
		address[] calldata tokens,
		address[] calldata tos,
		uint256[] calldata tokenIds,
		uint256[] calldata amounts,
		uint256[] calldata feeRebates
	) external virtual onlyController {
		require(tokens.length == tos.length, "Array size mismatch");
		require(tos.length == tokenIds.length, "Array size mismatch");
		require(tokenIds.length == amounts.length, "Array size mismatch");

		for(uint256 i = 0; i < tos.length; i++) {
			mixedFungibleClaims[tos[i]][tokens[i]][tokenIds[i]] += amounts[i];
			availableRebates[tos[i]] += feeRebates[i];
		}
	}

	function withdrawalFees(uint256 amount) external virtual onlyController {
		require(pendingFees >= amount, "Insufficient funds");
		pendingFees -= amount;
		tollToken.transfer(_msgSender(), amount);
	}

	function _rebateFee(address to) internal {
		// We do it this way to avoid a possible reentrancy attack
		uint256 balance = availableRebates[to];
		availableRebates[to] = 0;

		tollToken.transfer(to, balance);
	}
}
