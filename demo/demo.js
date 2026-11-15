const retry = document.querySelector('#retry');
document.addEventListener('script-dependent:ready', (event) => {
	const status = document.querySelector(`#${event.target.id}-status`);
	if (status) status.textContent = 'The word counter is ready.';
});
document.addEventListener('script-dependent:error', (event) => {
	const status = document.querySelector(`#${event.target.id}-status`);
	if (status)
		status.textContent =
			'The enhancement could not start. The ordinary text field is still available.';
	if (event.target.id === 'failure') retry.hidden = false;
});
retry.addEventListener('click', () => {
	document.querySelector('#failure').retry();
});
await import('../define.js');
