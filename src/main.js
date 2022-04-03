import Web3 from "web3"
import { newKitFromWeb3 } from "@celo/contractkit"
import BigNumber from "bignumber.js"
import treasuryAbi from "../contract/treasury.abi.json"
import erc20Abi from "../contract/erc20.abi.json"

const ERC20_DECIMALS = 18
const treasuryAddress = "0xE33dFFd95196185EA6E145B620906f9dC1FC0bBA"
const cUSDContractAddress = "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1"


const connectCeloWallet = async function () {
  if (window.celo || window.ethereum) {
    try {
      notification("⚠️ Please approve this DApp to use it.")
      await (window.celo || window.ethereum).enable()
      notificationOff()
      window.web3 = new Web3(window.celo || window.ethereum)
      window.kit = newKitFromWeb3(web3)

      const accounts = await kit.web3.eth.getAccounts()
      kit.defaultAccount = accounts[0]

      window.contract = new kit.web3.eth.Contract(treasuryAbi, treasuryAddress)
    } catch (error) {
      notification(`⚠️ ${error}.`)
    }
  } else {
    notification("⚠️ Please install the CeloExtensionWallet.")
  }
}

async function approve(amount) {
  const cUSDContract = new kit.web3.eth.Contract(erc20Abi, cUSDContractAddress)
  const result = await cUSDContract.methods
    .approve(treasuryAddress, amount)
    .send({ from: kit.defaultAccount })
  return result
}

const getBalance = async function () {
  try {
    const totalBalance = await kit.getTotalBalance(kit.defaultAccount)
    const cUSDBalance = totalBalance.cUSD.shiftedBy(-ERC20_DECIMALS).toFixed(2)
    document.querySelector("#balance").textContent = cUSDBalance
  } catch (error) {
    console.error(error)
  }
}

const renderAmount = (amount) => `
  <b class="text-${amount >= 0 ? "success" : "danger"}">
    ${new BigNumber(Math.abs(amount)).shiftedBy(-ERC20_DECIMALS).toFixed(2)} cUSD
  </b>
`

const getTreasury = async function () {
  window.treasuryAmount = await contract.methods.treasuryAmount().call()
  document.getElementById("treasuryAmount").innerHTML = new BigNumber(treasuryAmount).shiftedBy(-ERC20_DECIMALS).toFixed(2)
  
  window.maxAmount = await contract.methods.maxAmount().call()
  document.querySelector(".progress-bar").style.width = `${treasuryAmount * 100 / maxAmount}%`

  window.myBalance = await contract.methods.getBalance(kit.defaultAccount).call()
  document.getElementById("myBalance").innerHTML = +myBalance === 0 ? '' : `
    <b class="text-primary">${myBalance > 0 ? "Your contribution" : "Currently borrowing"}:</b>
    <span id="_amount">${new BigNumber(Math.abs(myBalance)).shiftedBy(-ERC20_DECIMALS).toFixed(2)} cUSD</span>
  `

  document.getElementById("add").innerHTML = myBalance >= 0 ? "Add" : "Return"
  document.getElementById("remove").innerHTML = myBalance <= 0 ? "Borrow" : "Remove"

  window.transactions = await contract.methods.getTransactions().call()
  const printTransaction = (previousBalance, amount) => {
    console.log(previousBalance, amount)
    if (amount >= 0) {
      if (previousBalance < 0) {
        if (previousBalance + amount > 0) {
          return `returned ${renderAmount(-previousBalance)} and added ${renderAmount(previousBalance + amount)}`
        }
        return `returned ${renderAmount(amount)}`
      }
      return `added ${renderAmount(amount)}`
    } else {
      if (previousBalance > 0) {
        if (previousBalance + amount < 0) {
          return `removed ${renderAmount(-previousBalance)} and borrowed ${renderAmount(previousBalance + amount)}`
        }
        return `removed ${renderAmount(amount)}`
      }
      return `borrowed ${renderAmount(amount)}`
    }
  }
  document.getElementById("transactions").innerHTML = [...transactions].reverse().map(t => `
    <div class="mb-2">
      <div class="d-flex align-items-center">
        ${identiconTemplate(t.from)}
        <div class="t ms-2 my-2" style="line-height: 1.2">${printTransaction(+t.previousBalance, +t.amount)}</div>
      </div>
      ${t.message ? `<div class="bg-light border rounded p-2 small" style="margin-left: 40px">${t.message}</div>` : ''}
    </div>
  `).join("")
}

function identiconTemplate(_address) {
  const icon = blockies
    .create({
      seed: _address,
      size: 8,
      scale: 16,
    })
    .toDataURL()
  return `
    <div class="rounded-circle overflow-hidden d-inline-block border border-white border-2 shadow-sm m-0" style="flex-shrink: 0">
      <a href="https://alfajores-blockscout.celo-testnet.org/address/${_address}/transactions"
          target="_blank">
          <img src="${icon}" width="28" alt="${_address}">
      </a>
    </div>
  `
}

function notification(_text) {
  document.querySelector(".alert").style.display = "block"
  document.querySelector("#notification").textContent = _text
}

function notificationOff() {
  document.querySelector(".alert").style.display = "none"
}

window.addEventListener("load", async () => {
  notification("⌛ Loading...")
  await connectCeloWallet()
  await getBalance()
  await getTreasury()
  notificationOff()
});

document.querySelector("button[data-type=plus]").addEventListener("click", () => {
  document.querySelector("input[name=amount]").value = Math.min(
    +document.querySelector("input[name=amount]").value + 1 // document.getElementById("treasuryAmount").textContent
  )
})

document.querySelector("button[data-type=minus]").addEventListener("click", () => {
  document.querySelector("input[name=amount]").value = Math.max(
    +document.querySelector("input[name=amount]").value - 1, 0
  )
})

document.querySelector("#myBalance").addEventListener("click", (e) => {
  if (e.target.id === "_amount") {
    document.querySelector("input[name=amount]").value = parseFloat(e.target.textContent)
  }
})

document.querySelector("#add").addEventListener("click", async (e) => {
  try {
    const value = document.querySelector("input[name=amount]").value
    const amount = new BigNumber(value).shiftedBy(ERC20_DECIMALS).toString()
    const message = document.querySelector("textarea[name=message]").value
    notification(`⌛ Approving ${value} cUSD…`)
    await approve(amount)
    notification(`⌛ ${myBalance >= 0 ? "Adding" : "Returning"} ${value} cUSD…`)
    await contract.methods.add(amount, message).send({ from: kit.defaultAccount })
    notification(`🎉 You successfully ${myBalance >= 0 ? "added" : "returned"} ${value} cUSD.`)
    getTreasury()
    document.querySelector("input[name=amount]").value = ''
    document.querySelector("textarea[name=message]").value = ''
  } catch (error) {
    notification(`⚠️ ${error}.`)
  }
})

document.querySelector("#remove").addEventListener("click", async (e) => {
  try {
    const value = document.querySelector("input[name=amount]").value
    const amount = new BigNumber(value).shiftedBy(ERC20_DECIMALS).toString()
    const message = document.querySelector("textarea[name=message]").value
    notification(`⌛ ${myBalance <= 0 ? "Borrowing" : "Removing"} ${value} cUSD…`)
    await contract.methods.remove(amount, message).send({ from: kit.defaultAccount })
    notification(`🎉 You successfully ${myBalance <= 0 ? "borrowed" : "removed"} ${value} cUSD.`)
    getTreasury()
    document.querySelector("input[name=amount]").value = ''
    document.querySelector("textarea[name=message]").value = ''
  } catch (error) {
    notification(`⚠️ ${error}.`)
  }
})
