// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./PriceConverter.sol";
import "hardhat/console.sol";

error FundMe__NotOwner();

/** @title a contract for crowd funding
 * @author Max Nechaev
 * @notice This contract is to demo sample funding contract
 * @dev This implements price feed as our library
 */
contract FundMe {
    using PriceConverter for uint;

    uint public constant MINIMUM_USD = 1 * 1e18;
    address private immutable i_owner;
    address[] private s_funders;
    mapping(address => uint) private s_addressToAmountFunded;
    AggregatorV3Interface private s_priceFeed;

    modifier onlyOwner() {
        if (msg.sender != i_owner) {
            revert FundMe__NotOwner();
        }
        _;
    }

    constructor(address priceFeedAddress) {
        i_owner = msg.sender;
        s_priceFeed = AggregatorV3Interface(priceFeedAddress);
    }

    receive() external payable {
        fund();
    }

    fallback() external payable {
        fund();
    }

    /**
     * @notice This function funds this contract
     * @dev This implements price feed as our library
     */
    function fund() public payable {
        // min 900000000000000
        require(
            msg.value.getConvertionRate(s_priceFeed) >= MINIMUM_USD,
            "Not enough funds!"
        );
        s_funders.push(msg.sender);
        s_addressToAmountFunded[msg.sender] += msg.value;
    }

    function withdraw() public payable onlyOwner {
        address[] memory funders = s_funders;
        for (uint i; i < funders.length; i++) {
            address funder = funders[i];
            s_addressToAmountFunded[funder] = 0;
        }
        s_funders = new address[](0);
        (bool success, ) = payable(msg.sender).call{
            value: address(this).balance
        }("");
        require(success, "Call failed");
    }

    function getOwner() public view returns (address) {
        return i_owner;
    }

    function getFunder(uint _funderIndex) public view returns (address) {
        return s_funders[_funderIndex];
    }

    function getAddressToAmountFunded(
        address _funder
    ) public view returns (uint) {
        return s_addressToAmountFunded[_funder];
    }

    function getPriceFeed() public view returns (AggregatorV3Interface) {
        return s_priceFeed;
    }
}
