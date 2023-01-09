const { expect } = require("chai")
const { deployments, ethers, getNamedAccounts } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("FundMe", async function() {
          let fundMe
          let deployer
          let mockV3Aggregator
          const sendValue = ethers.utils.parseEther("0.1")

          beforeEach(async function() {
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(["all"])
              fundMe = await ethers.getContract("FundMe", deployer)
              mockV3Aggregator = await ethers.getContract(
                  "MockV3Aggregator",
                  deployer
              )
          })

          describe("constructor", async function() {
              it("Sets aggregator addresses correctly", async function() {
                  const response = await fundMe.getPriceFeed()
                  expect(response).to.eq(mockV3Aggregator.address)
              })
          })

          describe("fund", async function() {
              it("Fails if you don't send enough ETH", async function() {
                  await expect(fundMe.fund()).to.be.revertedWith(
                      "Not enough funds!"
                  )
              })
              it("Update the amount funded data structure", async function() {
                  await fundMe.fund({ value: sendValue })
                  const response = await fundMe.getAddressToAmountFunded(
                      deployer
                  )
                  expect(response).to.eq(sendValue)
              })
              it("Should be added in funders array", async function() {
                  await fundMe.fund({ value: sendValue })
                  const response = await fundMe.getFunder(0)
                  expect(response).to.eq(deployer)
              })
          })

          describe("withdraw", async function() {
              beforeEach(async function() {
                  await fundMe.fund({ value: sendValue })
              })

              it("Withdraw eth from a single founder", async function() {
                  const startingContractBalance = await ethers.provider.getBalance(
                      fundMe.address
                  )
                  const startingDeployerAddress = await ethers.provider.getBalance(
                      deployer
                  )

                  const transactionResponse = await fundMe.withdraw()
                  const transactionReceipt = await transactionResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)

                  const updatingContractBalance = await ethers.provider.getBalance(
                      fundMe.address
                  )
                  const updatingDeployerAddress = await ethers.provider.getBalance(
                      deployer
                  )
                  expect(updatingContractBalance.toString()).to.eq("0")
                  expect(
                      startingContractBalance
                          .add(startingDeployerAddress)
                          .toString()
                  ).to.eq(updatingDeployerAddress.add(gasCost).toString())
              })
              it("Should clear funders array", async function() {
                  await fundMe.withdraw()
                  await expect(fundMe.getFunder(0)).to.be.reverted
              })
              it("Allows us to withdraw a multiple funders", async function() {
                  const accounts = await ethers.getSigners()
                  for (let i = 1; i < 6; i++) {
                      const fundMeConnectedContract = fundMe.connect(
                          accounts[i]
                      )
                      await fundMeConnectedContract.fund({ value: sendValue })
                  }

                  const startingContractBalance = await ethers.provider.getBalance(
                      fundMe.address
                  )
                  const startingDeployerAddress = await ethers.provider.getBalance(
                      deployer
                  )

                  const transactionResponse = await fundMe.withdraw()
                  const transactionReceipt = await transactionResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)

                  await expect(fundMe.getFunder(0)).to.be.reverted

                  for (let i = 1; i < 6; i++) {
                      const addressAmount = await fundMe.getAddressToAmountFunded(
                          accounts[i].address
                      )
                      expect(addressAmount).to.eq(0)
                  }
              })
              it("Allows only owner to call withdraw", async function() {
                  const accounts = await ethers.getSigners()
                  const signer = accounts[1]
                  await expect(
                      fundMe.connect(signer).withdraw()
                  ).to.be.revertedWithCustomError(fundMe, "FundMe__NotOwner")
              })
          })

          describe("receive", async function() {
              it("Should call receive and save funder", async function() {
                  const signers = await ethers.getSigners()
                  const signer = signers[0]

                  const tx = await signer.sendTransaction({
                      to: fundMe.address,
                      value: sendValue
                  })
                  const contractBalance = await ethers.provider.getBalance(
                      fundMe.address
                  )
                  const funderBalanceOnContract = await fundMe.getAddressToAmountFunded(
                      signer.address
                  )
                  expect(contractBalance.toString()).to.eq(sendValue.toString())
                  expect(funderBalanceOnContract.toString()).to.eq(
                      sendValue.toString()
                  )
              })
          })

          describe("fallback", async function() {
              it("Should call fallback and save funder", async function() {
                  const signers = await ethers.getSigners()
                  const signer = signers[0]

                  const data = ethers.utils.solidityPack(["string"], ["Alice"])
                  const tx = await signer.sendTransaction({
                      to: fundMe.address,
                      value: sendValue,
                      data: ethers.utils.hexlify(data)
                  })
                  const contractBalance = await ethers.provider.getBalance(
                      fundMe.address
                  )
                  const funderBalanceOnContract = await fundMe.getAddressToAmountFunded(
                      signer.address
                  )
                  expect(contractBalance.toString()).to.eq(sendValue.toString())
                  expect(funderBalanceOnContract.toString()).to.eq(
                      sendValue.toString()
                  )
              })
          })

          describe("getOwner", async function() {
              it("Sets correct owner", async function() {
                  const response = await fundMe.getOwner()
                  expect(response).to.eq(deployer)
              })
          })
      })
