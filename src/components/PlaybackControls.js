
import { __, _n, sprintf } from '../i18n';
import React, { Component } from 'preact-compat';
import PropTypes from 'prop-types';
import PlaybackButton from './PlaybackButton';
import { uniqueId } from '../helpers';

export default class PlaybackControls extends Component {
	constructor() {
		super();

		this.showDialog = this.showDialog.bind( this );
		this.hideDialog = this.hideDialog.bind( this );
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
			this.hideDialog();
		} );
	}

	componentDidUpdate() {
		this.updateDialogState();
	}

	showDialog() {
		this.setState( { dialogOpen: true } );
	}

	hideDialog() {
		this.setState( { dialogOpen: false } );
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
			this.props.onShowSettings();
		}
	}

	renderLanguageVoiceSelects() {
		if ( 0 === this.props.availableVoices.length || 0 === this.props.presentLanguages.length ) {
			return null;
		}

		const selects = [];
		for ( const presentLanguage of this.props.presentLanguages ) {
			const languageVoices = this.props.availableVoices.filter( ( voice ) => voice.lang.startsWith( presentLanguage ) );
			if ( 0 === languageVoices.length ) {
				continue;
			}

			selects.push(
				<p key={ presentLanguage }>
					{ sprintf( __( 'Voice (%s):' ), presentLanguage ) }
					{
						<select>
							{ languageVoices.map(
								( voice ) =>
									<option key={ voice.voiceURI } value={ voice.voiceURI }>
										{ voice.lang === voice.fullLang ?
											voice.name :
											sprintf( __( '%s (%s)' ), voice.name, voice.fullLang ) }
									</option>
							) }
						</select>
					}
				</p>
			);
		}
		return selects;
	}

	render() {
		const saveDialogRef = ( dialog ) => {
			this.dialog = dialog;
		};

		const classNames = [ 'spoken-word-playback-controls' ];
		const isPlaying = 'playing' === this.props.playback;

		return (
			<fieldset className={ classNames.join( ' ' ) }>
				<legend className="spoken-word-playback-controls__legend">{ __( 'Text to Speech' ) }</legend>

				<PlaybackButton
					useDashicon={ this.props.useDashicons }
					dashicon={ isPlaying ? 'controls-pause' : 'controls-play' }
					emoji={ isPlaying ? '⏸️' : '▶' }
					label={ isPlaying ? __( 'Pause' ) : __( 'Play' ) }
					onClick={ isPlaying ? this.props.stop : this.props.play }
				/>

				<PlaybackButton useDashicon={ this.props.useDashicons } dashicon="controls-back" emoji="⏪" label={ __( 'Previous' ) } onClick={ this.props.previous } />
				<PlaybackButton useDashicon={ this.props.useDashicons } dashicon="controls-forward" emoji="⏩" label={ __( 'Forward' ) } onClick={ this.props.next } />
				<PlaybackButton useDashicon={ this.props.useDashicons } dashicon="admin-settings" emoji="⚙" label={ __( 'Settings' ) } onClick={ this.showDialog } />

				<dialog ref={ saveDialogRef }>
					<p>
						<label htmlFor={ this.idPrefix + 'rate' }>{ __( 'Rate:' ) }</label>
						<input id={ this.idPrefix + 'rate' } type="number" defaultValue={1.0} step={0.1} />
					</p>
					<p>
						<label htmlFor={ this.idPrefix + 'pitch' }>{ __( 'Pitch:' ) }</label>
						<input id={ this.idPrefix + 'pitch' } type="number" defaultValue={1.0} step={0.1} />
					</p>
					{ this.renderLanguageVoiceSelects() }
					<button onClick={ this.hideDialog }>{ __( 'Close' ) }</button>
				</dialog>
			</fieldset>
		);
	}
}

PlaybackControls.propTypes = {
	playback: PropTypes.string.isRequired,
	play: PropTypes.func.isRequired,
	onShowSettings: PropTypes.func.isRequired,
	stop: PropTypes.func.isRequired,
	previous: PropTypes.func.isRequired,
	next: PropTypes.func.isRequired,
	useDashicons: PropTypes.bool,
	presentLanguages: PropTypes.array.isRequired,
	availableVoices: PropTypes.array.isRequired,
};

PlaybackControls.defaultProps = {
	useDashicons: false,
};
