//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./IBridge.sol";
import "./Controllable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

contract Bridge is IBridge, Controllable {
	/**
	 * @notice Stores how many of each token each user has a claim to
	 * mapping is as follows: user's address => token contract address => amount of token
	 */
	mapping (address => mapping (address => uint256)) public fungibleClaims; 

	function initialize(address _controller) public virtual override initializer {
		Controllable.initialize(_controller);
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
      require(networkId != chainId(), "Same chainId");

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
}
