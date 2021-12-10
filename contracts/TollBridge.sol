//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./Bridge.sol";


contract TollBridge is Bridge {

	/**
	 * @notice The ERC-20 token used to pay the bridge toll
	 */
	IERC20Upgradeable public tollToken;

	// Toll fees
	uint256 public fungibleFee;
	uint256 public nonFungibleFee;
	uint256 public mixedFungibleFee;
	// Fees that have been paid and can be withdrawn from this contract
	uint256 public pendingFees;

	function initialize(address _controller, address _tollToken) public virtual initializer {
		tollToken = IERC20Upgradeable(_tollToken);
		Bridge.__init_bridge(_controller);
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
	function transferFungible(address token, uint256 amount, uint256 networkId) external virtual override {
		IERC20Upgradeable(token).transferFrom(_msgSender(), address(this), amount);

      _payToll(fungibleFee);

      emit TokenTransferFungible(_msgSender(), token, amount, networkId);
   }

	/**
	 * @dev Used by bridge network to transfer the item directly to user without need for manual claiming
	 */
	function bridgeClaimFungibleWithFeeRebate(
		address token,
		address to,
		uint256 amount,
		uint256 feeRebate
	) external virtual onlyController {
		require(IERC20Upgradeable(token).balanceOf(address(this)) >= amount, "Insufficient liquidity");

		IERC20Upgradeable(token).transfer(to, amount);
		
		_rebateFee(to, feeRebate);

		emit TokenClaimedFungible(to, token, amount);
	}

	/**
	 * @dev Transfers an ERC721 token to a different chain
	 * This function simply moves the caller's tokens to this contract, and emits a `TokenTransferNonFungible` event
	 */
	function transferNonFungible(address token, uint256 tokenId, uint256 networkId) external virtual override {
		// require(networkId != chainId(), "Same chainId");

		IERC721Upgradeable(token).transferFrom(_msgSender(), address(this), tokenId);

		_payToll(nonFungibleFee);

		emit TokenTransferNonFungible(_msgSender(), token, tokenId, networkId);
	}

	/**
	 * @dev Used by bridge network to transfer the item directly to user without need for manual claiming
	 */
	function bridgeClaimNonFungibleWithFeeRebate(
		address token,
		address to,
		uint256 tokenId,
		uint256 feeRebate
	) external virtual onlyController {
		address tokenOwner;
		// The try-catch block is because `ownerOf` can (and I think is supposed to) revert if the item doesn't yet exist on this chain
		try IERC721Bridgable(token).ownerOf(tokenId) returns (address _owner) {
			tokenOwner = _owner;
		} catch {
			tokenOwner = address(0);
		}

		// Check if the token needs to be minted
		// If it does, attempt to mint it (will fail if this contract has no such permission, or the ERC721 contract doesn't support bridgeMint)
		// If the token exists, and the owner is this contract, it will be sent like normal
		// Otherwise this contract will revert
		if(tokenOwner == address(0)) {
			IERC721Bridgable(token).bridgeMint(_msgSender(), tokenId);
		} else {
			// This will revert if the bridge does not own the token; this is intended
			IERC721Bridgable(token).transferFrom(address(this), to, tokenId);
		}
	
		_rebateFee(to, feeRebate);

		emit TokenClaimedNonFungible(to, token, tokenId);
	}

	/**
	* @dev Transfers an ERC1155 token to a different chain
	* This function simply moves the caller's tokens to this contract, and emits a `TokenTransferMixedFungible` event
	*/
	function transferMixedFungible(
		address token,
		uint256 tokenId,
		uint256 amount,
		uint256 networkId
	) external virtual override {
		// require(networkId != chainId(), "Same chainId");

		IERC1155Upgradeable(token).safeTransferFrom(_msgSender(), address(this), tokenId, amount, toBytes(0));

		_payToll(mixedFungibleFee);

		emit TokenTransferMixedFungible(_msgSender(), token, tokenId, amount, networkId);
	}

	/**
	 * @dev Used by bridge network to transfer the item directly to user without need for manual claiming
	 */
	function bridgeClaimMixedFungibleWithFeeRebate(
		address token,
		address to,
		uint256 tokenId,
		uint256 amount,
		uint256 feeRebate
	) external virtual onlyController {
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

		_rebateFee(to, feeRebate);

		emit TokenClaimedMixedFungible(to, token, tokenId, amount);
	}

	function withdrawalFees(uint256 amount) external virtual onlyController {
		require(pendingFees >= amount, "Insufficient funds");
		pendingFees -= amount;
		tollToken.transfer(_msgSender(), amount);
	}

	function _rebateFee(address to, uint256 balance) internal {
		if(balance > 0) {
			tollToken.transfer(to, balance);
		}
	}

	/**
	* @dev Pull the an amount of `tollToken` equal to `_fee` from the user's account to pay the bridge toll
	*/
	function _payToll(uint256 _fee) internal {
		if(_fee > 0) {
			tollToken.transferFrom(_msgSender(), address(this), _fee);
		}
	}
}
