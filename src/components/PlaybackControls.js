
import { __ } from '../i18n';
import React, { Component } from 'preact-compat';
import PropTypes from 'prop-types';
import PlaybackButton from './PlaybackButton';
import { uniqueId } from '../helpers';

export default class PlaybackControls extends Component {
	constructor() {
		super();
		this.state = {
			dialogOpen: false,
		};
	}

	componentWillMount() {
		this.idPrefix = `input${ uniqueId() }-`;
	}

	componentDidMount() {
		this.updateDialogState();
		this.dialog.addEventListener( 'cancel', ( event ) => {
			event.preventDefault();
			this.setState( { dialogOpen: false } );
		} );
	}

	componentDidUpdate() {
		this.updateDialogState();
	}

	updateDialogState() {
		if ( ! this.state.dialogOpen && this.dialog.open ) {
			this.dialog.close();
			if ( this.previousActiveElement ) {
				this.previousActiveElement.focus();
			}
		} else if ( this.state.dialogOpen && ! this.dialog.open ) {
			this.previousActiveElement = document.activeElement;
			this.dialog.showModal();
		}
	}

	render() {
		const showDialog = () => {
			this.setState( { dialogOpen: true } );
		};
		const hideDialog = () => {
			this.setState( { dialogOpen: false } );
		};
		const saveDialogRef = ( dialog ) => {
			this.dialog = dialog;
		};

		const classNames = [ 'spoken-word-playback-controls' ];

		// Prevent MutationObserver in wpEmoji from interfering with React-rendered element.
		classNames.push( 'wp-exclude-emoji' );

		const isPlaying = 'playing' === this.props.playback;

		return (
			<fieldset className={ classNames.join( ' ' ) }>
				<legend>{ __( 'Text to Speech' ) }</legend>

				<PlaybackButton
					useDashicon={ this.props.useDashicons }
					dashicon={ isPlaying ? 'controls-pause' : 'controls-play' }
					emoji={ isPlaying ? '⏸️' : '▶' }
					label={ isPlaying ? __( 'Pause' ) : __( 'Play' ) }
					onClick={ isPlaying ? this.props.stop : this.props.play }
				/>

				<PlaybackButton useDashicon={ this.props.useDashicons } dashicon="controls-back" emoji="⏪" label={ __( 'Previous' ) } onClick={ this.props.previous } />
				<PlaybackButton useDashicon={ this.props.useDashicons } dashicon="controls-forward" emoji="⏩" label={ __( 'Forward' ) } onClick={ this.props.next } />
				<PlaybackButton useDashicon={ this.props.useDashicons } dashicon="admin-settings" emoji="⚙" label={ __( 'Settings' ) } onClick={ showDialog } />

				<dialog ref={ saveDialogRef }>
					<p>
						<label htmlFor={ this.idPrefix + 'rate' }>{ __( 'Rate:' ) }</label>
						<input id={ this.idPrefix + 'rate' } type="number" defaultValue={1.0} />
					</p>
					<p>
						<label htmlFor={ this.idPrefix + 'pitch' }>{ __( 'Pitch:' ) }</label>
						<input id={ this.idPrefix + 'pitch' } type="number" defaultValue={1.0} />
					</p>
					<p>
						<label htmlFor={ this.idPrefix + 'voice[en]' }>{ __( 'Voice:' ) }</label>
						<select id={ this.idPrefix + 'voice[en]' }>
							<option>Alex</option>
						</select>
					</p>
					<button onClick={ hideDialog }>{ __( 'Close' ) }</button>
				</dialog>
			</fieldset>
		);
	}
}

PlaybackControls.propTypes = {
	playback: PropTypes.string.isRequired,
	play: PropTypes.func.isRequired,
	stop: PropTypes.func.isRequired,
	previous: PropTypes.func.isRequired,
	next: PropTypes.func.isRequired,
	useDashicons: PropTypes.bool,
};

PlaybackControls.defaultProps = {
	useDashicons: false,
};
