import stylized_logo from '../assets/aetherium-logo.webp';


export default () => {
	return (
		<div className="aetheriumDivider">
			<div className="divider-line"></div>
			<div className="aetherium-logo">
				<img src={stylized_logo} alt="Aetherium Logo" />
			</div>
			<div className="divider-line"></div>
		</div>
	);
};
