import {
	Operator,
} from '../types/operators';

export const PrecedenceMap: { [key: string]: number } = {
	[Operator.Xor]: 12,
	[Operator.Asterik]: 10,
	[Operator.PercentSign]: 10,
	[Operator.Slash]: 10,
	[Operator.Plus]: 9,
	[Operator.Minus]: 9,
	[Operator.And]: 2,
	[Operator.Or]: 1,
	[Operator.LessThan]: 3,
	[Operator.GreaterThan]: 3,
	[Operator.LeftShift]: 7,
	[Operator.RightShift]: 7,
	[Operator.UnsignedRightShift]: 7,
	[Operator.LessThanOrEqual]: 3,
	[Operator.GreaterThanOrEqual]: 3,
	[Operator.Equal]: 3,
	[Operator.NotEqual]: 3,
	[Operator.BitwiseOr]: 1,
	[Operator.BitwiseAnd]: 2
};

export default function getPrecedence(operator: Operator): number {
	if (operator in PrecedenceMap) {
		return PrecedenceMap[operator];
	}

	return 0;
}