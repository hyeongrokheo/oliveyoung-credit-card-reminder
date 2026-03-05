/**
 * 임직원 할인 계산 유틸리티
 * 나중에 상품 가격 계산 기능 추가 시 사용
 */

/**
 * 할인된 최종 가격 계산
 * @param {number} originalPrice - 원래 가격
 * @param {number} remainingLimit - 잔여 한도
 * @returns {number} 최종 가격
 */
function calculateDiscountedPrice(originalPrice, remainingLimit) {
  if (originalPrice <= 0) return 0;

  // 한도 내 금액: 40% 할인
  const priceWithinLimit = Math.min(originalPrice, remainingLimit);
  const discountWithinLimit = priceWithinLimit * 0.4;

  // 한도 초과 금액: 10% 할인
  const priceOverLimit = Math.max(0, originalPrice - remainingLimit);
  const discountOverLimit = priceOverLimit * 0.1;

  // 최종 가격 = 원래 가격 - 총 할인액
  const totalDiscount = discountWithinLimit + discountOverLimit;
  const finalPrice = originalPrice - totalDiscount;

  return Math.round(finalPrice);
}

/**
 * 할인 정보 계산
 * @param {number} originalPrice - 원래 가격
 * @param {number} remainingLimit - 잔여 한도
 * @returns {object} 할인 정보 { finalPrice, discount, limitUsed }
 */
function getDiscountInfo(originalPrice, remainingLimit) {
  console.log('[올리브영 할인 한도] getDiscountInfo 호출:', { originalPrice, remainingLimit });
  const finalPrice = calculateDiscountedPrice(originalPrice, remainingLimit);
  const discount = originalPrice - finalPrice;
  const limitUsed = Math.min(originalPrice, remainingLimit);

  const result = {
    finalPrice,
    discount,
    limitUsed,
  };
  console.log('[올리브영 할인 한도] getDiscountInfo 결과:', result);
  return result;
}

/**
 * 가격을 한국 원화 형식으로 포맷
 * @param {number} price - 가격
 * @returns {string} 포맷된 가격 문자열
 */
function formatPrice(price) {
  return price.toLocaleString('ko-KR') + '원';
}
