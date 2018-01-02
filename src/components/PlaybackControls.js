
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

		return (
			<fieldset>
				<legend>Playback</legend>
				<PlaybackButton icon="▶" label="Play" onClick={ this.props.play } />
				<PlaybackButton icon="⏹" label="Stop" onClick={ this.props.stop } />
				<PlaybackButton icon="⏪" label="Previous" onClick={ this.props.previous } />
				<PlaybackButton icon="⏩" label="Forward" onClick={ this.props.next } />
				<PlaybackButton icon="⚙" label="Settings" onClick={ showDialog } />

				<dialog ref={ saveDialogRef }>
					<p>
						<label htmlFor={ this.idPrefix + 'rate' }>Rate:</label>
						<input id={ this.idPrefix + 'rate' } type="number" defaultValue={1.0} />
					</p>
					<p>
						<label htmlFor={ this.idPrefix + 'pitch' }>Pitch:</label>
						<input id={ this.idPrefix + 'pitch' } type="number" defaultValue={1.0} />
					</p>
					<p>
						<label htmlFor={ this.idPrefix + 'voice[en]' }>English Voice:</label>
						<select id={ this.idPrefix + 'voice[en]' }>
							<option>Alex</option>
						</select>
					</p>
					<button onClick={ hideDialog }>Close</button>
				</dialog>
			</fieldset>
		);
	}
}

PlaybackControls.propTypes = {
	play: PropTypes.func.isRequired,
	stop: PropTypes.func.isRequired,
	previous: PropTypes.func.isRequired,
	next: PropTypes.func.isRequired,
};
