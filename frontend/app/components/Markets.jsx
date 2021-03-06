/** @jsx React.DOM */

var React = require("react");
var Fluxxor = require("fluxxor");
var FluxChildMixin = Fluxxor.FluxMixin(React);

// var MarketFilter = require("./MarketFilter"); TODO
var GraphPrice = require('./GraphPriceRickshaw');
var MarketList = require("./MarketList");

var Markets = React.createClass({
  mixins: [FluxChildMixin],

  render: function() {
    // console.log(this.props);
    // <MarketFilter market={this.props.market} trades={this.props.trades} user={this.props.user} />
    return (
      <div>
        <div className="container-fluid">
          <div className="row">
            {!this.props.market.error && (
              <div>
                <GraphPrice market={this.props.market} />
                <MarketList title={this.props.title} market={this.props.market} trades={this.props.trades} user={this.props.user} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

});

module.exports = Markets;
