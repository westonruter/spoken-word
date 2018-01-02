import React, { Component } from 'preact-compat';
import PropTypes from 'prop-types';

export default class PlaybackButton extends Component {
	render() {
		const style = {
			fontFamily: '"Apple Color Emoji","Segoe UI Emoji","NotoColorEmoji","Segoe UI Symbol","Android Emoji","EmojiSymbols"',
			background: 'none',
			border: 'none',
			cursor: 'pointer',
		};
		return (
			<button type="button" aria-label={ this.props.label } style={ style } onClick={ this.props.onClick }>
				{ this.props.icon }
			</button>
		);
	}
}

PlaybackButton.propTypes = {
	label: PropTypes.string.isRequired,
	icon: PropTypes.string.isRequired,
	onClick: PropTypes.func.isRequired,
};
