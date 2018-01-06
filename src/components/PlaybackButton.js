import React, { Component } from 'preact-compat';
import PropTypes from 'prop-types';

export default class PlaybackButton extends Component {
	render() {
		const style = {};
		const buttonClassNames = [ 'spoken-word-playback-controls__button' ];

		if ( this.props.useDashicon ) {
			buttonClassNames.push( 'spoken-word-playback-controls__button--dashicon' );
		} else {
			// Prevent MutationObserver in wpEmoji from interfering with React-rendered element.
			buttonClassNames.push( 'wp-exclude-emoji' );
			buttonClassNames.push( 'spoken-word-playback-controls__button--emoji' );
		}

		let pressed;
		if ( typeof this.props.pressed !== 'undefined' ) {
			pressed = this.props.pressed ? 'true' : 'false';
		}

		return (
			<button aria-pressed={ pressed } type="button" className={ buttonClassNames.join( ' ' ) } style={ style } aria-label={ this.props.label } onClick={ this.props.onClick }>
				{ this.props.useDashicon ?
					<span className={ 'dashicons dashicons-' + this.props.dashicon } /> :
					this.props.emoji
				}
			</button>
		);
	}
}

PlaybackButton.propTypes = {
	pressed: PropTypes.bool,
	label: PropTypes.string.isRequired,
	emoji: PropTypes.string.isRequired,
	dashicon: PropTypes.string.isRequired,
	useDashicon: PropTypes.bool.isRequired,
	onClick: PropTypes.func.isRequired,
};
