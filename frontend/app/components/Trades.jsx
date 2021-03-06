/** @jsx React.DOM */

var React = require("react");
var Fluxxor = require("fluxxor");
var FluxChildMixin = Fluxxor.FluxMixin(React);

var TradeForm = require("./TradeForm");
var TradeList = require("./TradeList");

var Trades = React.createClass({
  mixins: [FluxChildMixin],

  render: function() {
    this.props.user.user.own = false;
    return (
      <div>
        <TradeForm market={this.props.market} trades={this.props.trades} user={this.props.user} />
        <div className="container-fluid">
          <div className="row">
            {!this.props.market.error &&
              <TradeList market={this.props.market} trades={this.props.trades} user={this.props.user} />}
          </div>
        </div>
      </div>
    );
  }

});

module.exports = Trades;
