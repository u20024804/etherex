var Fluxxor = require("fluxxor");

var bigRat = require("big-rational");
var fixtures = require("../js/fixtures");
var constants = require("../js/constants");
var utils = require("../js/utils");

var TradeStore = Fluxxor.createStore({

    initialize: function(options) {
        this.title = "Trades";
        this.trades = options.trades || {};
        this.loading = true;
        this.updating = false;
        this.error = null;
        this.percent = 0;
        this.type = 1;
        this.price = null;
        this.amount = null;
        this.total = null;
        this.filling = [];
        this.amountLeft = 0;
        this.available = 0;
        this.newAmount = false;

        this.bindActions(
            constants.trade.LOAD_TRADES, this.onLoadTrades,
            constants.trade.LOAD_TRADES_PROGRESS, this.onLoadTradesProgress,
            constants.trade.LOAD_TRADES_SUCCESS, this.onLoadTradesSuccess,
            constants.trade.LOAD_TRADES_FAIL, this.onTradesFail,
            constants.trade.UPDATE_TRADES, this.onUpdateTrades,
            constants.trade.UPDATE_TRADES_PROGRESS, this.onLoadTradesProgress,
            constants.trade.UPDATE_TRADES_SUCCESS, this.onLoadTradesSuccess,
            constants.trade.UPDATE_TRADES_FAIL, this.onTradesFail,
            constants.trade.ADD_TRADE, this.onAddTrade,
            constants.trade.ADD_TRADE_FAIL, this.onTradesFail,
            constants.trade.FILL_TRADES, this.onFillTrades,
            constants.trade.FILL_TRADES_FAIL, this.onTradesFail,
            constants.trade.FILL_TRADE, this.onFillTrade,
            constants.trade.FILL_TRADE_FAIL, this.onTradesFail,
            constants.trade.CANCEL_TRADE, this.onCancelTrade,
            constants.trade.CANCEL_TRADE_FAIL, this.onTradesFail,
            constants.trade.HIGHLIGHT_FILLING, this.onHighlightFilling,
            constants.trade.HIGHLIGHT_FILLING_FAIL, this.onTradesFail,
            constants.trade.CLICK_FILL, this.onClickFill,
            constants.trade.CLICK_FILL_FAIL, this.onTradesFail,
            constants.trade.CLICK_FILL_SUCCESS, this.onClickFillSuccess,
            constants.trade.SWITCH_MARKET, this.switchMarket,
            constants.trade.SWITCH_MARKET_FAIL, this.onTradesFail,
            constants.trade.SWITCH_TYPE, this.switchType,
            constants.trade.SWITCH_TYPE_FAIL, this.onTradesFail
        );
    },

    onLoadTrades: function() {
        this.trades = {};
        this.loading = true;
        this.error = null;
        this.percent = 0;
        this.emit(constants.CHANGE_EVENT);
    },

    onUpdateTrades: function() {
        this.loading = true;
        this.updating = true;
        this.error = null;
        this.percent = 0;
        this.emit(constants.CHANGE_EVENT);
    },

    onLoadTradesProgress: function(payload) {
        console.log("Progress: " + payload.percent);
        // this.trades = payload.trades || [];
        this.percent = payload.percent;
        this.emit(constants.CHANGE_EVENT);
    },

    onLoadTradesSuccess: function(payload) {
        // Split in buys/sells
        var trades = _.groupBy(payload, 'type');
        var market = this.flux.store("MarketStore").getState().market;

        // Sort
        this.trades.buys = _.sortBy(trades.buys, 'price').reverse();
        this.trades.sells = _.sortBy(trades.sells, 'price');

        // Update trades state
        this.trades.tradeBuys = this.trades.buys;
        this.trades.tradeSells = this.trades.sells;

        // Filter by market
        this.filterMarket(market, this.trades);

        this.loading = false;
        this.updating = false;
        // this.error = null;
        this.percent = 100;
        this.emit(constants.CHANGE_EVENT);
    },

    onAddTrade: function(payload) {
        var trade = {
            id: payload.id,
            type: (payload.type == 1) ? 'buy' : 'sell',
            price: payload.price,
            amount: payload.amount,
            total: payload.amount * payload.price,
            market: this.flux.store("MarketStore").getState().markets[payload.market],
            owner: this.flux.store("UserStore").getState().user.id,
            status: payload.status
        };

        // Add and re-sort... TODO improve that...
        (payload.type == 1) ? this.trades.buys.push(trade) : this.trades.sells.push(trade);
        (payload.type == 1) ?
            this.trades.buys = _.sortBy(this.trades.buys, 'price').reverse() :
            this.trades.sells = _.sortBy(this.trades.sells, 'price');

        this.emit(constants.CHANGE_EVENT);
    },

    onFillTrade: function(payload) {
        var index = _.findIndex((payload.type == "buys") ? this.trades.buys : this.trades.sells, {'id': payload.id});

        console.log("Filling trade ", payload, " at index " + index);

        (payload.type == "buys") ? this.trades.buys[index].status = "success" : this.trades.sells[index].status = "success";

        this.emit(constants.CHANGE_EVENT);
    },

    onFillTrades: function(payload) {
        var ids = _.pluck(payload, 'id');

        console.log("Filling trades " + ids.join(', '));

        for (var i = ids.length - 1; i >= 0; i--) {
            var index = _.findIndex(
                (payload[i].type == "buys") ? this.trades.buys : this.trades.sells,
                {'id': ids[i]}
            );
            (payload[i].type == "buys") ?
                this.trades.buys[index].status = "success" :
                this.trades.sells[index].status = "success";
            this.emit(constants.CHANGE_EVENT);
        };

        this.filling = [];
        this.amountLeft = null;
        this.available = null;
        this.price = null;
        this.amount = null;
        this.total = null;
    },

    onCancelTrade: function(payload) {
        var index = _.findIndex((payload.type == "buys") ? this.trades.buys : this.trades.sells, {'id': payload.id});

        console.log("Cancelling trade ", payload, " at index " + index);

        (payload.type == "buys") ? this.trades.buys[index].status = "new" : this.trades.sells[index].status = "new";

        this.emit(constants.CHANGE_EVENT);
    },

    onHighlightFilling: function(payload) { // type, price, amount, total, market, user
        // console.log(payload);
        var trades = (payload.type == 1) ? this.trades.tradeSells : this.trades.tradeBuys;
        var siblings = (payload.type == 1) ? this.trades.tradeBuys : this.trades.tradeSells;
        var total_amount = 0;
        var trades_total = 0;
        var filling = []; //this.filling;
        var amountLeft = payload.amount;
        var available = payload.total;

        // console.log(filling);

        // Reset same type trades
        if (siblings)
            for (var i = 0; i <= siblings.length - 1; i++) {
                if (_.find(this.filling, {'id': siblings[i].id})) {
                    _.remove(this.filling, {'id': siblings[i].id})
                    if (siblings[i].status == "filling")
                        siblings[i].status = "mined";
                    // Add back to available and amountLeft
                    // amountLeft += siblings[i].amount;
                    // available += siblings[i].amount * siblings[i].price;
                }
            }

        // Remove currently filling amounts and totals
        // for (var i = filling.length - 1; i >= 0; i--) {
        //     amountLeft -= filling[i].amount;
        //     available -= filling[i].amount * filling[i].price;
        // };

        console.log("===");

        for (var i = 0; i <= trades.length - 1; i++) {

            // Add totals and amounts
            if (trades[i].owner != payload.user.id) {
                var this_total = trades[i].amount * trades[i].price;
                // console.log("against total of " + this_total);
                total_amount += trades[i].amount;
                trades_total += this_total;
            }

            // Reset to normal first if we no longer have enough
            if ((((payload.type == 1 && payload.price < trades[i].price) ||
                  (payload.type == 2 && payload.price > trades[i].price)) ||
                   payload.price <= 0 ||
                   available < this_total ||
                   amountLeft < trades[i].amount) &&
                   trades[i].owner != payload.user.id &&
                   trades[i].status != "pending" &&
                   trades[i].status != "new") {

                (payload.type == 1) ?
                    this.trades.tradeSells[i].status = "mined" :
                    this.trades.tradeBuys[i].status = "mined"

                if (_.find(filling, {'id': trades[i].id})) {
                    // Remove from state for filling trades for fillTrades
                    _.remove(filling, {'id': trades[i].id});

                    // Add back to available and amountLeft
                    amountLeft += trades[i].amount;
                    available += this_total;
                }

                // console.log("Unfilling, available: " + utils.formatBalance(bigRat(available).multiply(fixtures.ether).valueOf()));
            }

            // Highlight trades that would get filled, or partially (TODO)
            if (((payload.type == 1 && payload.price >= trades[i].price) ||
                 (payload.type == 2 && payload.price <= trades[i].price)) &&
                  payload.price > 0 &&
                  amountLeft >= trades[i].amount &&
                  available >= this_total &&
                  trades[i].owner != payload.user.id &&
                  trades[i].market.id == payload.market.id &&
                  trades[i].status != "pending" &&
                  trades[i].status != "new") {

                console.log("Would fill trade # " + i + " with total of " + trades_total);

                (payload.type == 1) ? // if (available >= this_total)
                  this.trades.tradeSells[i].status = "filling" :
                  this.trades.tradeBuys[i].status = "filling"

                if (!_.find(filling, {'id': trades[i].id})) {
                    filling.push(trades[i]);

                    // Remove total from available total
                    // if (available - this_total > 0)
                        available -= this_total;
                    // else
                    //     available = 0;
                    // if (amountLeft - trades[i].amount > 0)
                        amountLeft -= trades[i].amount;
                    // else
                    //     amountLeft = 0;
                }
            }
        };

        // // DEBUG Partial filling adds a new trade for remaining available
        // console.log("Available: " + utils.formatBalance(bigRat(available).multiply(fixtures.ether).valueOf()));
        // console.log("From balance of " + this.props.user.user.balance);
        if (payload.price > 0) {
            if (amountLeft * payload.price >= payload.market.minTotal &&
                filling.length > 0 &&
                available > 0) {
                console.log("Would also add new trade for " + amountLeft + " " + payload.market.name +
                            " for " + utils.formatBalance(bigRat(amountLeft)
                                    .multiply(payload.price)
                                    .multiply(fixtures.ether)));
            }
            else if (amountLeft * payload.price >= payload.market.minTotal &&
                     filling.length > 0 &&
                     amountLeft > 0 &&
                     available > 0) {
                console.log("Not enough left for a new trade, needs " +
                    utils.formatBalance(bigRat(payload.market.minTotal).multiply(fixtures.ether)) +
                    ", total left is " + utils.formatBalance(bigRat(amountLeft).multiply(payload.price).multiply(fixtures.ether)) +
                    ", available left would be " + utils.formatBalance(bigRat(available).multiply(fixtures.ether)));
            }
            else if (filling.length == 0) {
                console.log("Would add new trade for " + payload.amount + " " + payload.market.name +
                            " for " + utils.formatBalance(bigRat(available).multiply(fixtures.ether)));
            }
        }
        console.log("Filling " + filling.length + " trade(s): " + _.pluck(filling, 'id').join(', '));

        // Set state for filling trades for fillTrades
        // this.type = payload.type;
        // this.price = payload.price;
        // this.amount = payload.amount;
        // this.total = payload.total;
        this.filling = filling;
        this.amountLeft = amountLeft;
        this.available = available;
        // console.log(this);

        this.emit(constants.CHANGE_EVENT);
    },

    onClickFill: function(payload) {
        if (!payload.market)
            return;
        var market = this.flux.store("MarketStore").getState().markets[payload.market.id];
        var decimals = market.decimals;
        var precision = market.precision.length - 1;
        var amount = (payload.type == 2 || !payload.fills || payload.fills <= 1) ?
            payload.amount.toFixed(decimals) :
            (parseFloat(payload.amount) + 1 / Math.pow(10, decimals)).toFixed(decimals)
        this.amount = amount;
        this.price = payload.price;
        this.total = (amount * payload.price).toFixed(precision) || payload.total;
        this.newAmount = true;
        this.type = payload.type == 1 ? 2 : 1;

        this.emit(constants.CHANGE_EVENT);
        this.newAmount = false;
    },

    onClickFillSuccess: function(payload) {
        this.newAmount = false;
        // this.type = payload.type == 1 ? 2 : 1;
        // this.emit(constants.CHANGE_EVENT);
    },

    switchType: function(payload) {
        this.type = payload;
        this.emit(constants.CHANGE_EVENT);
    },

    switchMarket: function(payload) {
        this.filterMarket(payload, {buys: this.trades.tradeBuys, sells: this.trades.tradeSells});
        this.emit(constants.CHANGE_EVENT);
    },

    filterMarket: function(market, trades) {
        // Filter by market
        var market_filter = {
            id: _.parseInt(market.id),
            name: market.name
        };
        // console.log("Filtering for market " + market.name, "with", market_filter, "on", trades);

        this.trades.buys = _.filter(trades.buys, {'market': market_filter});
        this.trades.sells = _.filter(trades.sells, {'market': market_filter});
    },

    onTradesFail: function(payload) {
        console.log("TRADES ERROR: ", payload.error);
        this.trades = payload || {};
        this.loading = false;
        this.percent = 0;
        this.error = payload.error;
        this.emit(constants.CHANGE_EVENT);
    },

    getState: function() {
        return {
            tradeBuys: _.values(this.trades.buys),
            tradeSells: _.values(this.trades.sells),
            // tradeById: this.trades,
            loading: this.loading,
            error: this.error,
            title: this.title,
            percent: this.percent,
            type: this.type,
            price: this.price,
            amount: this.amount,
            total: this.total,
            filling: this.filling,
            amountLeft: this.amountLeft,
            available: this.available,
            newAmount: this.newAmount
        };
    }
});

module.exports = TradeStore;
