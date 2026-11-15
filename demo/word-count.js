export async function initialize(element, { signal }) {
	await new Promise((resolve, reject) => {
		const aborted = () => {
			clearTimeout(timer);
			reject(signal.reason);
		};
		const timer = setTimeout(() => {
			signal.removeEventListener('abort', aborted);
			resolve();
		}, 600);
		signal.addEventListener('abort', aborted, { once: true });
		if (signal.aborted) aborted();
	});
	const field = element.closest('.demo').querySelector('textarea');
	const button = element.querySelector('button');
	const output = element.querySelector('output');
	if (!field || !button || !output)
		throw new Error('The word counter needs a field, button and output.');
	button.addEventListener(
		'click',
		() => {
			const text = field.value.trim();
			output.value = String(text ? text.split(/\s+/u).length : 0);
		},
		{ signal },
	);
}
