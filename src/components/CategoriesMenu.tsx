import React, { useState } from 'react';
import { CaretLeftIcon } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { CaretRightIcon } from '@phosphor-icons/react/dist/csr/CaretRight';
import { HamburgerIcon } from '@phosphor-icons/react/dist/csr/Hamburger';
import { ListIcon } from '@phosphor-icons/react/dist/csr/List';
import { XIcon } from '@phosphor-icons/react/dist/csr/X';

interface Category {
	type: string;
	label: string;
}

interface CategoriesMenuProps {
	categories: Category[];
	selectedCategory: string;
	onCategoryChange: (categoryType: string) => void;
	title?: string;
}

const CategoriesMenu: React.FC<CategoriesMenuProps> = ({
	categories,
	selectedCategory,
	onCategoryChange,
	title = 'Categories',
}) => {
	// Default to collapsed if window width < 1600px
	const [collapsed, setCollapsed] = useState(() => {
		if (typeof window !== 'undefined') {
			return window.innerWidth < 1600;
		}
		return false;
	});

	return (
		<div className={`categoriesMenu ${collapsed ? 'collapsed' : ''}`}>
			<button
				onClick={() => setCollapsed(!collapsed)}
				className="categoriesMenu--collapsible"
				title={collapsed ? 'Expand menu' : 'Collapse menu'}
			>
				{collapsed ? (
					<ListIcon size={22} weight="bold" />
				) : (
					<XIcon size={22} weight="bold" />
				)}
			</button>

			<div style={{ position: 'relative', height: '100%' }}>
				<div className="categoriesColumn">
					<h2 className="columnTitle">
						{title}{' '}
						<XIcon
							size={22}
							weight="bold"
							className="categoriesMenu--closeIcon"
							onClick={() => setCollapsed(!collapsed)}
						/>
					</h2>
					<div className="categoriesList">
						{categories.map((cat) => (
							<button
								key={cat.type}
								className={`categoryCard ${
									selectedCategory === cat.type
										? 'active'
										: ''
								}`}
								onClick={() => {
									setCollapsed(true);
									onCategoryChange(cat.type)
								}}
							>
								<span className="label">{cat.label}</span>
							</button>
						))}
					</div>
				</div>
			</div>
		</div>
	);
};

export default CategoriesMenu;
