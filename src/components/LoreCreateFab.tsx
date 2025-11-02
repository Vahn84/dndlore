import {
	Books,
	GlobeHemisphereWest,
	Sparkle,
	UsersThree,
} from 'phosphor-react';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type LoreType = 'history' | 'campaign' | 'people' | 'myth';

const LoreCreateFab: React.FC = () => {
	const [open, setOpen] = useState(false);
	const surfaceRef = useRef<HTMLDivElement | null>(null);
	const navigate = useNavigate();

	// Close panel with Escape
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) =>
			e.key === 'Escape' && setOpen(false);
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [open]);

	// Close when clicking/tapping outside the surface
	useEffect(() => {
		if (!open) return;
		const onPointerDown = (e: MouseEvent | TouchEvent) => {
			const el = surfaceRef.current;
			if (!el) return;
			const target = e.target as Node | null;
			if (target && !el.contains(target)) {
				setOpen(false);
			}
		};
		document.addEventListener('mousedown', onPointerDown);
		document.addEventListener('touchstart', onPointerDown, { passive: true });
		return () => {
			document.removeEventListener('mousedown', onPointerDown);
			document.removeEventListener('touchstart', onPointerDown);
		};
	}, [open]);

	const handleCreate = (type: string) => navigate(`/lore/${type}/new`);

	const onSurfaceKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (
		e
	) => {
		if (!open && (e.key === 'Enter' || e.key === ' ')) {
			e.preventDefault();
			setOpen(true);
		}
	};

	return (
		<div className="lore-create-fab" aria-live="polite">
			<div
				className="lcfab__surface"
				data-open={open}
				ref={surfaceRef}
				role={!open ? 'button' : undefined}
				tabIndex={!open ? 0 : -1}
				aria-expanded={open}
				aria-controls="lcfab-panel"
				onClick={!open ? () => setOpen(true) : undefined}
				onKeyDown={onSurfaceKeyDown}
			>
				{/* Closed state: plus icon */}
				<span className="lcfab__plus" aria-hidden>
					<i className="icon icli iconly-Plus"></i>
				</span>

				{/* Open state content (fades/slides in) */}
				<div
					id="lcfab-panel"
					className="lcfab__content"
					aria-hidden={!open}
				>
					<div className="lcfab__content_wrapper">
						<div
							className="lcfab__content_wrapper--option history-option"
							onClick={() => handleCreate('history')}
						>
							<Books
								size={18}
								className="lcfab__content_wrapper--option-icon"
							/>
							History
						</div>
						<div
							className="lcfab__content_wrapper--option campaign-option"
							onClick={() => handleCreate('campaign')}
						>
							<GlobeHemisphereWest
								size={18}
								className="lcfab__content_wrapper--option-icon"
							/>
							Campaign
						</div>
						<div
							className="lcfab__content_wrapper--option people-option"
							onClick={() => handleCreate('people')}
						>
							<UsersThree
								size={18}
								className="lcfab__content_wrapper--option-icon"
							/>
							People&Orgs
						</div>
						<div
							className="lcfab__content_wrapper--option myth-option"
							onClick={() => handleCreate('myth')}
						>
							<Sparkle
								size={18}
								className="lcfab__content_wrapper--option-icon"
							/>
							Myths&Legends
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default LoreCreateFab;
