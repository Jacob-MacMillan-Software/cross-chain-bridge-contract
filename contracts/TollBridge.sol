//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./Bridge.sol";


contract TollBridge is Bridge {
	// Fees that have been paid and can be withdrawn from this contract
	mapping (address => uint256) public pendingFees;

	event TokenTransferFungible(
		address indexed from,
		address indexed token,
		uint256 amount,
		uint256 networkId,
		address feeToken,
		uint256 feeAmount
	);
	event TokenTransferMixedFungible(
		address indexed from,
		address indexed token,
		uint256 tokenId,
		uint256 amount,
		uint256 networkId,
		address feeToken,
		uint256 feeAmount
	);
	event TokenTransferNonFungible(
		address indexed from,
		address indexed token,
		uint256 tokenId,
		uint256 networkId,
		address feeToken,
		uint256 feeAmount
	);

	function initialize(address _controller) public virtual initializer {
		Bridge.__init_bridge(_controller);
	}

	/**
	 * @dev Transfers an ERC20 token to a different chain
	 * This function simply moves the caller's tokens to this contract, and emits a `TokenTransferFungible` event
	 */
	function transferFungible(
		address _token,
	   uint256 _amount,
		uint256 _networkId,
		address _feeToken,
		uint256 _feeAmount
	) external virtual {
		IERC20Upgradeable(_token).transferFrom(_msgSender(), address(this), _amount);

      _payToll(_feeToken, _feeAmount);

      emit TokenTransferFungible(_msgSender(), _token, _amount, _networkId, _feeToken, _feeAmount);
   }

	/**
	 * @dev Transfers an ERC721 token to a different chain
	 * This function simply moves the caller's tokens to this contract, and emits a `TokenTransferNonFungible` event
	 */
	function transferNonFungible(
		address _token,
		uint256 _tokenId,
		uint256 _networkId,
		address _feeToken,
		uint256 _feeAmount
	) external virtual {
		// require(networkId != chainId(), "Same chainId");

		IERC721Upgradeable(_token).transferFrom(_msgSender(), address(this), _tokenId);

		_payToll(_feeToken, _feeAmount);

		emit TokenTransferNonFungible(_msgSender(), _token, _tokenId, _networkId, _feeToken, _feeAmount);
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
		address _feeToken,
		uint256 _feeAmount
	) external virtual {
		// require(networkId != chainId(), "Same chainId");

		IERC1155Upgradeable(_token).safeTransferFrom(_msgSender(), address(this), _tokenId, _amount, toBytes(0));

		_payToll(_feeToken, _feeAmount);

		emit TokenTransferMixedFungible(_msgSender(), _token, _tokenId, _amount, _networkId, _feeToken, _feeAmount);
	}

	function withdrawalFees(address _token, uint256 _amount) external virtual onlyController {
		require(pendingFees[_token] >= _amount, "Insufficient funds");
		pendingFees[_token] -= _amount;
		IERC20Upgradeable(_token).transfer(_msgSender(), _amount);
	}

	/**
	* @dev Pull the an amount of `tollToken` equal to `_fee` from the user's account to pay the bridge toll
	*/
	function _payToll(address _token, uint256 _fee) internal {
		if(_fee > 0) {
			pendingFees[_token] += _fee;
			IERC20Upgradeable(_token).transferFrom(_msgSender(), address(this), _fee);
		}
	}
}
