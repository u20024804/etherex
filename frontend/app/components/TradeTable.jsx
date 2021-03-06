/** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");

var Fluxxor = require("fluxxor");
var FluxChildMixin = Fluxxor.FluxMixin(React);

var ProgressBar = require('react-bootstrap/ProgressBar');
var ModalTrigger = require('react-bootstrap/ModalTrigger');
var ConfirmModal = require('./ConfirmModal');

var Table = require("react-bootstrap/Table");
var Button = require("react-bootstrap/Button");
var Glyphicon = require("react-bootstrap/Glyphicon");

var bigRat = require("big-rational");
var fixtures = require("../js/fixtures");
var utils = require("../js/utils");

// var Link = Router.Link;
// var UserLink = require("./UserLink");

var TradeRow = React.createClass({
    mixins: [FluxChildMixin],

    getInitialState: function() {
        return {
            payload: {}
        };
    },

    render: function() {
        var isOwn = (this.props.trade.owner == this.props.user.id);
        return (
            <tr className={"trade-" + (!this.props.review ? this.props.trade.status : "review") + ((isOwn && !this.props.user.own) ? " disabled" : "")} onMouseEnter={this.handleHover} onMouseLeave={this.handleHoverOut} onClick={this.handleClick}>
                <td>
                    <div className="text-right">
                        {utils.numeral(this.props.trade.amount, 2)}
                    </div>
                </td>
                <td>
                    <div className="text-center">
                        {this.props.trade.market.name}
                    </div>
                </td>
                <td>
                    <div className="text-right">
                        {utils.numeral(this.props.trade.price, 4)}
                    </div>
                </td>
                <td>
                    <div className="text-right">
                        {utils.numeral(this.props.trade.total, 2)} ETH
                    </div>
                </td>
                <td>
                    <div className="center-block ellipsis">
                        {this.props.trade.owner}
                    </div>
                </td>
                {!this.props.review &&
                <td className="trade-op">
                    <div className="pull-right">{
                    (this.props.trade.owner == this.props.user.id) ?
                        <ModalTrigger modal={
                                <ConfirmModal
                                    type="cancel"
                                    message="Are you sure you want to cancel this trade?"
                                    trade={this.props.trade}
                                    flux={this.getFlux()}
                                    onSubmit={this.handleCancelTrade}
                                />
                            }>
                            <Button className="btn-xs" key="cancel"><Glyphicon glyph="remove" /></Button>
                        </ModalTrigger> :

                        <ModalTrigger modal={
                                <ConfirmModal
                                    type="fill"
                                    message={
                                        "Are you sure you want to " + (this.props.trade.type == "buys" ? "sell" : "buy") +
                                        " " + this.props.trade.amount + " " + this.props.trade.market.name +
                                        " at " + this.props.trade.price + " " + this.props.trade.market.name + "/ETH" +
                                        " for " + (this.props.trade.amount * this.props.trade.price) + " ETH"
                                    }
                                    flux={this.getFlux()}
                                    onSubmit={this.handleFillTrade}
                                />
                            }>
                            <Button className="btn-xs" key="fill"><Glyphicon glyph="screenshot" /></Button>
                        </ModalTrigger>
                    }</div>
                </td>}
            </tr>
        );
    },

    handleFillTrade: function(e) {
        this.getFlux().actions.trade.fillTrade(this.props.trade);
    },

    handleCancelTrade: function(e) {
        this.getFlux().actions.trade.cancelTrade(this.props.trade);
    },

    handleHover: function(e) {
        if (this.props.review)
            return;

        if (!this.props.trade.price || !this.props.trade.amount || !this.props.trade.total)
            return;

        // Select previous trades
        var totalAmount = 0;
        var thisUser = this.props.user;
        var thisTrade = this.props.trade;
        var count = this.props.count;
        var trades = _.filter(this._owner.props.tradeList, function(trade, i) {
            return (
                thisUser.id != trade.owner &&
                trade.status != "pending" &&
                trade.status != "new" &&
                ((trade.type == "buys" && thisTrade.price <= trade.price) ||
                 (trade.type == "sells" && thisTrade.price >= trade.price)) &&
                i <= count
            );
        });

        if (!trades.length)
            return;

        totalAmount = _.reduce(_.pluck(trades, 'amount'), function(sum, num) {
            return parseFloat(sum) + parseFloat(num);
        });
        totalValue = _.reduce(_.pluck(trades, 'total'), function(sum, num) {
            return parseFloat(sum) + parseFloat(num);
        });

        if (!totalAmount || !totalValue)
            return;

        var total = totalAmount * this.props.trade.price;

        console.log("======")
        console.log("Needs " + totalAmount + " " + this.props.trade.market.name +
                    " for " + utils.formatBalance(bigRat(total).multiply(fixtures.ether))); // , trades);

        var isBuy = (this.props.trade.type == "buys" ? true : false);
        var payload = {
            type: (isBuy ? 1 : 2),
            price: this.props.trade.price,
            amount: isBuy ? totalValue / this.props.trade.price : totalAmount,
            total: isBuy ? totalValue : total,
            market: this.props.trade.market,
            user: this.props.user
        };

        // console.log(payload);

        this.getFlux().actions.trade.highlightFilling(payload);

        _.forEach(this._owner.props.tradeList, function(trade) {
            if (!_.find(trades, {'id': trade.id}) && trade.status == "filling")
                trade.status = "mined";
            else if (_.find(trades, {'id': trade.id}) && trade.status == "mined")
                trade.status = "filling";
        });

        payload.fills = trades.length;

        this.setState({
            payload: payload
        });
    },

    handleHoverOut: function(e) {
        if (!this._owner._owner.props.trades)
            return;

        var payload = {
            type: this._owner._owner.props.trades.type,
            price: this._owner._owner.props.trades.price,
            amount: this._owner._owner.props.trades.amount,
            total: this._owner._owner.props.trades.total,
            market: this.props.trade.market,
            user: this.props.user
        };

        this.getFlux().actions.trade.highlightFilling(payload);
    },

    handleClick: function(e) {
        if (this.state.payload)
            this.getFlux().actions.trade.clickFill(this.state.payload);
    }
});

var TradeTable = React.createClass({
    render: function() {
        var tradeListNodes = this.props.tradeList.map(function (trade, i) {
            return (
                <TradeRow key={trade.id} count={i} trade={trade} user={this.props.user} review={this.props.review} />
            );
        }.bind(this));
        return (
            <div>
                <h4>{this.props.title}</h4>
                <Table condensed hover responsive striped>
                    <thead>
                        <tr>
                            <th className="text-right">Amount</th>
                            <th className="text-center">Market</th>
                            <th className="text-right">Price</th>
                            <th className="text-right">Total</th>
                            <th className="text-center">By</th>
                            {!this.props.review &&
                            <th className="text-center trade-op"></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {tradeListNodes}
                    </tbody>
                </Table>
            </div>
        );
    }
});

module.exports = TradeTable;
