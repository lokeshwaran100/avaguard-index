//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Fund.sol";
import "./AGIToken.sol";

/**
 * Fund Factory Contract - Creates and manages index funds
 * @author Avanguard Index
 */
contract FundFactory is Ownable {
    // Fund creation fee in AGI tokens
    uint256 public constant FUND_CREATION_FEE = 1000 * 10**18; // 1000 AGI tokens
    
    // Contracts
    AGIToken public agiToken;
    address public oracle;
    address public treasury;
    address public dex;
    address public wavax;
    
    // Fund tracking
    Fund[] public funds;
    mapping(uint256 => Fund) public fundById;
    mapping(address => uint256[]) public creatorFunds;
    
    // Events
    event FundCreated(
        uint256 indexed fundId,
        address indexed creator,
        string fundName,
        string fundTicker,
        address fundAddress,
        address[] underlyingTokens
    );
    
    constructor(
        address _agiToken,
        address _oracle,
        address _treasury,
        address _dex,
        address _wavax,
        address initialOwner
    ) Ownable(initialOwner) {
        agiToken = AGIToken(_agiToken);
        oracle = _oracle;
        treasury = _treasury;
        dex = _dex;
        wavax = _wavax;
    }

    /**
     * @dev Returns the fund creation fee.
     */
    function creationFee() external pure returns (uint256) {
        return FUND_CREATION_FEE;
    }
    
    /**
     * @dev Create a new fund
     * @param fundName Name of the fund
     * @param fundTicker Ticker symbol for the fund
     * @param tokens Array of underlying token addresses
     * @param weightages Array of token weightages (in basis points, 100% = 10000)
     */
    function createFund(
        string memory fundName,
        string memory fundTicker,
        address[] memory tokens,
        uint256[] memory weightages
    ) external {
        require(bytes(fundName).length > 0, "Fund name cannot be empty");
        require(bytes(fundTicker).length > 0, "Fund ticker cannot be empty");
        require(tokens.length > 0, "Must have at least one token");
        require(tokens.length <= 20, "Maximum 20 tokens per fund");
        require(tokens.length == weightages.length, "Tokens and weightages length mismatch");
        
        // Check for duplicate tokens and validate weightages
        uint256 totalWeightage = 0;
        for (uint256 i = 0; i < tokens.length; i++) {
            require(tokens[i] != address(0), "Invalid token address");
            require(weightages[i] > 0, "Weightage must be greater than 0");
            totalWeightage += weightages[i];
            
            for (uint256 j = i + 1; j < tokens.length; j++) {
                require(tokens[i] != tokens[j], "Duplicate tokens not allowed");
            }
        }
        require(totalWeightage == 10000, "Total weightage must be 100%");
        
        // Burn AGI tokens as creation fee
        require(
            agiToken.balanceOf(msg.sender) >= FUND_CREATION_FEE,
            "Insufficient AGI balance for fund creation fee"
        );
        agiToken.burnFrom(msg.sender, FUND_CREATION_FEE);
        
        // Create new fund
        Fund newFund = new Fund(
            fundName,
            fundTicker,
            tokens,
            weightages,
            msg.sender,
            oracle,
            treasury,
            dex,
            wavax
        );
        
        // Track the fund
        uint256 fundId = funds.length;
        funds.push(newFund);
        fundById[fundId] = newFund;
        creatorFunds[msg.sender].push(fundId);
        
        emit FundCreated(
            fundId,
            msg.sender,
            fundName,
            fundTicker,
            address(newFund),
            tokens
        );
    }
    
    /**
     * @dev Get fund information by ID
     * @param fundId The fund ID
     * @return fundAddress The fund contract address
     * @return fundName The fund name
     * @return fundTicker The fund ticker
     * @return underlyingTokens Array of underlying token addresses
     * @return weightages Array of token weightages
     */
    function getFund(uint256 fundId) external view returns (
        address fundAddress,
        string memory fundName,
        string memory fundTicker,
        address[] memory underlyingTokens,
        uint256[] memory weightages
    ) {
        require(fundId < funds.length, "Fund does not exist");
        Fund fund = funds[fundId];
        fundAddress = address(fund);
        fundName = fund.fundName();
        fundTicker = fund.fundTicker();
        underlyingTokens = fund.getUnderlyingTokens();
        ( , weightages) = fund.getAllTokenWeightages();
    }
    
    /**
     * @dev Get all funds created by a specific creator
     * @param creator The creator address
     * @return Array of fund IDs created by the creator
     */
    function getCreatorFunds(address creator) external view returns (uint256[] memory) {
        return creatorFunds[creator];
    }
    
    /**
     * @dev Get total number of funds
     * @return Total number of funds created
     */
    function getTotalFunds() external view returns (uint256) {
        return funds.length;
    }
    
    /**
     * @dev Get all funds (for frontend pagination)
     * @param startIndex Starting index
     * @param endIndex Ending index
     * @return Array of fund addresses
     */
    function getFunds(uint256 startIndex, uint256 endIndex) external view returns (address[] memory) {
        require(startIndex < funds.length, "Start index out of bounds");
        require(endIndex <= funds.length, "End index out of bounds");
        require(startIndex <= endIndex, "Invalid index range");
        
        uint256 count = endIndex - startIndex;
        address[] memory fundAddresses = new address[](count);
        
        for (uint256 i = 0; i < count; i++) {
            fundAddresses[i] = address(funds[startIndex + i]);
        }
        
        return fundAddresses;
    }
    
    /**
     * @dev Update oracle address (only owner)
     * @param newOracle New oracle address
     */
    function updateOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Invalid oracle address");
        oracle = newOracle;
    }
    
    /**
     * @dev Update treasury address (only owner)
     * @param newTreasury New treasury address
     */
    function updateTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury address");
        treasury = newTreasury;
    }
    
    /**
     * @dev Update AGI token address (only owner)
     * @param newAgiToken New AGI token address
     */
    function updateAgiToken(address newAgiToken) external onlyOwner {
        require(newAgiToken != address(0), "Invalid AGI token address");
        agiToken = AGIToken(newAgiToken);
    }
    
    /**
     * @dev Update DEX address (only owner)
     * @param newDex New DEX address
     */
    function updateDex(address newDex) external onlyOwner {
        require(newDex != address(0), "Invalid DEX address");
        dex = newDex;
    }
    
    /**
     * @dev Update WAVAX address (only owner)
     * @param newWavax New WAVAX address
     */
    function updateWavax(address newWavax) external onlyOwner {
        require(newWavax != address(0), "Invalid WAVAX address");
        wavax = newWavax;
    }
}
