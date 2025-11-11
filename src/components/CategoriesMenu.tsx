import React, { useState } from 'react';
import { CaretLeft, CaretRight } from 'phosphor-react';

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
	const [collapsed, setCollapsed] = useState(false);

	return (
		<div className={`categoriesMenu ${collapsed ? 'collapsed' : ''}`}>
			<button
				onClick={() => setCollapsed(!collapsed)}
				className="categoriesMenu--collapsible"
				title={collapsed ? 'Expand menu' : 'Collapse menu'}
			>
				{collapsed ? (
					<CaretRight size={22} weight="bold" />
				) : (
					<CaretLeft size={22} weight="bold" />
				)}
			</button>

			<div style={{ position: 'relative', height: '100%' }}>
				<div className="categoriesColumn">
					<h2 className="columnTitle">{title}</h2>
					<div className="categoriesList">
						{categories.map((cat) => (
							<button
								key={cat.type}
								className={`categoryCard ${
									selectedCategory === cat.type
										? 'active'
										: ''
								}`}
								onClick={() => onCategoryChange(cat.type)}
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
