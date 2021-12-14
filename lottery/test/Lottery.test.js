const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');
const web3 = new Web3(ganache.provider());
const { interface, bytecode } = require('../compile');

let accounts;
let lottery;

beforeEach(async () => {
    accounts = await web3.eth.getAccounts();
    lottery = await new web3.eth.Contract(JSON.parse(interface))
                        .deploy({ data: bytecode })
                        .send({ from: accounts[0], gas: '1000000' });
});

describe('Lottery Contract', () => {
    it('deploys a contract', () => {
        assert.ok(lottery.options.address);
    });

    it('allows one account to enter', async () => {
        await lottery.methods.enter().send({
            from: accounts[0],
            value: web3.utils.toWei('0.02', 'ether')
        });

        const players = await lottery.methods.getPlayers().call();

        assert.equal(accounts[0], players[0]);
        assert.equal(1, players.length);
    });

    it('allows multiple accounts to enter', async () => {
        await lottery.methods.enter().send({
            from: accounts[0],
            value: web3.utils.toWei('0.02', 'ether')
        });
        await lottery.methods.enter().send({
            from: accounts[1],
            value: web3.utils.toWei('0.02', 'ether')
        });
        await lottery.methods.enter().send({
            from: accounts[2],
            value: web3.utils.toWei('0.02', 'ether')
        });

        const players = await lottery.methods.getPlayers().call();

        assert.equal(accounts[0], players[0]);
        assert.equal(accounts[1], players[1]);
        assert.equal(accounts[2], players[2]);
        assert.equal(3, players.length);
    });

    it('require minimum ether to enter', async () => {
        try {
            await lottery.methods.enter().send({
                from: accounts[2],
                value: 0
            });   
            throw(false);
        } catch (error) {
            assert(error);
        }
    });

    it('only manager can call pickWinner', async () =>{
        try{
            await lottery.methods.enter().send({
                from: accounts[2],
                value: web3.utils.toWei('0.02', 'ether')
            });

            await lottery.methods.pickWinner().call({
                from: accounts[1]
            });
            throw(false);
        }
        catch(error){
            assert(error);
        }
    });

    it('sends money to the winner and reset the players array', async () => {
        await lottery.methods.enter().send({
            from: accounts[1],
            value: web3.utils.toWei('2', 'ether')
        });
        let players;
        let lotteryBalance;
        players = await lottery.methods.getPlayers().call();
        assert.equal(1, players.length);

        // check the balance of the contract before transfer
        // Situation:  sender has send the money but winner is not decided
        lotteryBalance = await web3.eth.getBalance(lottery.options.address);
        assert(lotteryBalance > 1.8);

        const initialBalance = await web3.eth.getBalance(accounts[1]);
        await lottery.methods.pickWinner().send({ from: accounts[0] });
        const finalBalance = await web3.eth.getBalance(accounts[1]);
        const difference = finalBalance - initialBalance;
        
        // because some ether are spend in gas
        assert(difference > web3.utils.toWei('1.8', 'ether')); 
        
        players = await lottery.methods.getPlayers().call();
        // players array reset
        assert.equal(0, players.length);

        // check the balance of the contract after transfer
        lotteryBalance = await web3.eth.getBalance(lottery.options.address);
        assert.equal(0, lotteryBalance);
    })
});