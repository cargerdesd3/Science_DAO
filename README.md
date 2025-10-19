# Science DAO: Decentralized Research Funding & IP Licensing 🌐🔬

Science DAO is a pioneering platform designed to revolutionize the landscape of scientific research funding and intellectual property (IP) licensing. This project leverages Zama's Fully Homomorphic Encryption (FHE) technology to enable a secure and decentralized funding model that empowers scientists and investors to collaboratively support research initiatives while safeguarding sensitive information. 

## Identifying the Challenge 🚧

In an age where scientific challenges grow in complexity, traditional funding models often fall short. Researchers frequently struggle to secure grants due to lack of transparency and cumbersome bureaucratic processes. Additionally, protecting intellectual property becomes a significant hurdle when monetizing research findings. There is a pressing need for a system that allows for efficient funding while ensuring confidentiality, accessibility, and equitable participation from diverse stakeholders.

## The FHE Solution 🔐

Zama's Fully Homomorphic Encryption technology provides an elegant solution to these issues by allowing sensitive data to remain encrypted while computations are performed. Through Zama's open-source libraries such as **Concrete**, **TFHE-rs**, and the **zama-fhe SDK**, Science DAO enables encrypted voting on research proposals, allowing DAO members to make funding decisions without compromising privacy. This revolutionary technology ensures that both the funding process and the resultant IP can be securely managed and patented as NFTs, thus streamlining the path from research conception to funding to application.

## Key Features 🌟

- **Encrypted Research Proposals:** Proposals are submitted and evaluated using FHE, ensuring confidentiality throughout the peer review process.
- **Decentralized Voting:** DAO members participate in private voting to determine which projects receive funding, enhancing fairness and community involvement.
- **NFT-Based IP Management:** Research outputs are minted as NFTs, allowing for simple licensing and revenue sharing through royalties that support the DAO’s treasury.
- **Community-Driven Governance:** Members have the ability to propose amendments to funding criteria, creating a responsive governance structure.
- **Interactive Dashboards:** Comprehensive proposal boards and governance dashboards for real-time tracking of funding and project status.

## Technology Stack 🛠️

The Science DAO project utilizes a robust technology stack including:

- **Solidity:** For smart contract development.
- **Node.js:** Backend services to manage user interactions and system processes.
- **Hardhat/Foundry:** Development environments for testing and deploying smart contracts.
- **Zama SDKs (Concrete, TFHE-rs):** Enabling the secure handling of encrypted data for proposals and voting.

## Directory Structure 🗂️

Below is the structure of the project repository, showcasing the smart contract file along with other essential directories:

```
Science_DAO/
│
├── contracts/
│   └── Science_DAO.sol
│
├── scripts/
│   └── deploy.js
│
├── tests/
│   └── Science_DAO_test.js
│
├── package.json
├── hardhat.config.js
├── README.md
└── .env
```

## Installation Guide 🚀

To get started with the Science DAO project, follow these installation instructions, assuming you have already downloaded the project files.

1. Ensure that you have **Node.js** installed on your system.
2. Navigate to the project root directory in your terminal.
3. Execute the following command to install dependencies and required libraries, including Zama's FHE libraries:

   ```bash
   npm install
   ```

4. **IMPORTANT:** Do **not** use `git clone` or any URLs to fetch this project.

## Build & Run Guide 🏗️

After installing the necessary dependencies, you can build and run the project using the following commands:

1. **Compile the smart contracts:**

   ```bash
   npx hardhat compile
   ```

2. **Run the tests:**

   ```bash
   npx hardhat test
   ```

3. **Deploy the smart contract to the desired network:**

   ```bash
   npx hardhat run scripts/deploy.js --network [network_name]
   ```

4. Make sure to replace `[network_name]` with the target blockchain network in your Hardhat configuration.

## Sample Code Snippet 💻

Here’s an example of how you might submit a research proposal using the Science DAO smart contract:

```solidity
pragma solidity ^0.8.0;

import "./Science_DAO.sol";

contract ResearchProposal {
    Science_DAO public dao;

    constructor(address _daoAddress) {
        dao = Science_DAO(_daoAddress);
    }

    function submitProposal(string memory title, string memory description) public {
        // Functionality to encrypt and submit the research proposal
        dao.submitEncryptedProposal(title, description);
    }
}
```

This snippet demonstrates how a new research proposal can be submitted securely, integrating seamlessly with the DAO's functionalities.

## Acknowledgements 🙏

Powered by Zama: A heartfelt thank you to the Zama team for their pioneering work on Fully Homomorphic Encryption and for providing the open-source tools that make confidential blockchain applications like Science DAO possible. Your contributions are vital in advancing secure and equitable scientific research funding!

With Science DAO, we are one step closer to a decentralized future for collaborative research that benefits us all! Join us in shaping the next era of scientific exploration and innovation.