import React, { Component } from 'preact-compat';
import PropTypes from 'prop-types';

export default class PlaybackButton extends Component {
	render() {
		const style = {};
		const buttonClassNames = [ 'spoken-word-playback-controls__button' ];

		if ( ! this.props.useDashicon ) {
			style.fontFamily = '"Apple Color Emoji", "Segoe UI Emoji", "NotoColorEmoji", "Segoe UI Symbol", "Android Emoji", "EmojiSymbols"';
		}

		return (
			<button type="button" className={ buttonClassNames.join( ' ' ) } style={ style } aria-label={ this.props.label } onClick={ this.props.onClick }>
				{ this.props.useDashicon ?
					<span className={ 'dashicons dashicons-' + this.props.dashicon } /> :
					this.props.emoji
				}
			</button>
		);
	}
}

PlaybackButton.propTypes = {
	label: PropTypes.string.isRequired,
	emoji: PropTypes.string.isRequired,
	dashicon: PropTypes.string.isRequired,
	useDashicon: PropTypes.bool.isRequired,
	onClick: PropTypes.func.isRequired,
};
