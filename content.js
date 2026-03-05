(async function() {
  'use strict';

  // 플로팅 UI 상태
  let floatingUI = null;
  let limitData = {
    limit: null,
    lastUpdated: null,
    loading: false,
  };

  /**
   * 할인 한도 조회 API 호출
   */
  async function fetchDiscountLimit() {
    try {
      console.log('[올리브영 할인 한도] API 호출 시작');
      limitData.loading = true;
      updateUI();

      // 저장된 카드 정보 가져오기
      const stored = await chrome.storage.local.get(['acqrCd', 'cardNo', 'cardAvalTermYm']);
      console.log('[올리브영 할인 한도] 저장된 카드 정보:', stored);

      if (!stored.acqrCd || !stored.cardNo || !stored.cardAvalTermYm) {
        throw new Error('카드 정보가 설정되지 않았습니다.\n확장 프로그램 아이콘을 클릭하여 설정하세요.');
      }

      // MMYY를 YYMM으로 변환 (API 요구 형식)
      const mmyy = stored.cardAvalTermYm; // 예: "0732"
      const mm = mmyy.substring(0, 2); // "07"
      const yy = mmyy.substring(2, 4); // "32"
      const yymm = yy + mm; // "3207"

      // API 요청
      const formData = new URLSearchParams({
        acqrCd: stored.acqrCd,
        cardNo: stored.cardNo,
        cardAvalTermYm: yymm,
      });

      console.log('[올리브영 할인 한도] API 요청 전송');
      const response = await fetch('https://www.oliveyoung.co.kr/store/order/getCjDscntLmtJson.do', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: formData,
        credentials: 'include',
      });

      console.log('[올리브영 할인 한도] API 응답 상태:', response.status);
      if (!response.ok) {
        throw new Error(`API 요청 실패: ${response.status}`);
      }

      const result = await response.json();
      console.log('[올리브영 할인 한도] API 응답:', result);

      if (result.result !== 'S') {
        throw new Error(result.message || 'API 요청에 실패했습니다.');
      }

      // 데이터 업데이트
      limitData.limit = result.data;
      limitData.lastUpdated = new Date();
      limitData.loading = false;

      console.log('[올리브영 할인 한도] 데이터 업데이트 완료:', limitData.limit);
      updateUI();

      // 장바구니 정보 갱신
      if (typeof refreshCartInfo === 'function') {
        refreshCartInfo();
      }

      // 상품 상세 정보 갱신
      if (typeof refreshProductDetailInfo === 'function') {
        refreshProductDetailInfo();
      }
    } catch (error) {
      console.error('[올리브영 할인 한도] 오류:', error);
      limitData.loading = false;
      limitData.limit = null;
      updateUI(error.message);
    }
  }

  /**
   * 플로팅 UI 생성
   */
  function createFloatingUI() {
    const container = document.createElement('div');
    container.id = 'oy-discount-limit-float';
    container.innerHTML = `
      <div class="oy-float-header">
        <span class="oy-float-title">임직원 할인 한도</span>
        <div class="oy-float-actions">
          <button class="oy-float-refresh" title="새로고침">↻</button>
          <button class="oy-float-minimize" title="최소화">−</button>
        </div>
      </div>
      <div class="oy-float-content">
        <div class="oy-float-limit">
          <span class="oy-float-label">잔여 한도</span>
          <span class="oy-float-value">-</span>
        </div>
        <div class="oy-float-updated">마지막 업데이트: -</div>
        <div class="oy-float-error" style="display: none;"></div>
      </div>
    `;

    document.body.appendChild(container);
    floatingUI = container;

    // 이벤트 리스너
    const refreshBtn = container.querySelector('.oy-float-refresh');
    const minimizeBtn = container.querySelector('.oy-float-minimize');

    refreshBtn.addEventListener('click', () => {
      fetchDiscountLimit().then(() => {
        refreshCartInfo();
        refreshProductDetailInfo();
      });
    });

    minimizeBtn.addEventListener('click', () => {
      container.classList.toggle('minimized');
    });

    // 드래그 기능
    let isDragging = false;
    let currentX, currentY, initialX, initialY;

    const header = container.querySelector('.oy-float-header');

    header.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      initialX = e.clientX - container.offsetLeft;
      initialY = e.clientY - container.offsetTop;
      container.style.transition = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      container.style.left = currentX + 'px';
      container.style.top = currentY + 'px';
      container.style.right = 'auto';
      container.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        container.style.transition = '';
      }
    });

    return container;
  }

  /**
   * UI 업데이트
   */
  function updateUI(errorMessage = null) {
    if (!floatingUI) return;

    const valueEl = floatingUI.querySelector('.oy-float-value');
    const updatedEl = floatingUI.querySelector('.oy-float-updated');
    const errorEl = floatingUI.querySelector('.oy-float-error');

    if (errorMessage) {
      valueEl.textContent = '오류';
      valueEl.className = 'oy-float-value error';
      updatedEl.style.display = 'none';
      errorEl.textContent = errorMessage;
      errorEl.style.display = 'block';
      return;
    }

    errorEl.style.display = 'none';
    updatedEl.style.display = 'block';

    if (limitData.loading) {
      valueEl.textContent = '로딩 중...';
      valueEl.className = 'oy-float-value loading';
      updatedEl.textContent = '마지막 업데이트: -';
      return;
    }

    if (limitData.limit !== null) {
      valueEl.textContent = limitData.limit.toLocaleString('ko-KR') + '원';
      valueEl.className = 'oy-float-value';

      const time = limitData.lastUpdated.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      updatedEl.textContent = `마지막 업데이트: ${time}`;
    } else {
      valueEl.textContent = '-';
      valueEl.className = 'oy-float-value';
      updatedEl.textContent = '마지막 업데이트: -';
    }
  }

  /**
   * 장바구니에서 상품금액(배송비 제외)과 배송비를 각각 추출
   */
  function getCartPriceBreakdown() {
    const detailPrice = document.querySelector('.total_price_info .detail_price');
    if (!detailPrice) return null;

    const priceNums = detailPrice.querySelectorAll('p > span > .tx_num');
    // 순서: 총 판매가, 총 할인금액, 배송비
    if (priceNums.length < 3) return null;

    const totalSalePrice = parseInt(priceNums[0].textContent.trim().replace(/,/g, ''), 10);
    const totalDiscountAmount = parseInt(priceNums[1].textContent.trim().replace(/,/g, ''), 10);
    const shippingFee = parseInt(priceNums[2].textContent.trim().replace(/,/g, ''), 10);

    if (isNaN(totalSalePrice) || isNaN(totalDiscountAmount) || isNaN(shippingFee)) return null;

    return {
      productPrice: totalSalePrice - totalDiscountAmount,
      shippingFee,
    };
  }

  /**
   * 장바구니에서 총 결제예상금액 추출 (폴백용)
   */
  function getCartTotalPrice() {
    const totalPriceEl = document.querySelector('.total_price_info .sum_price .tx_price .tx_num');
    if (!totalPriceEl) return null;

    const priceText = totalPriceEl.textContent.trim().replace(/,/g, '');
    const price = parseInt(priceText, 10);
    return isNaN(price) ? null : price;
  }

  /**
   * 장바구니에 임직원 할인 정보 표시
   */
  function displayCartDiscountInfo() {
    console.log('[올리브영 할인 한도] 장바구니 정보 표시 시작');

    // 이미 표시된 요소가 있으면 제거
    const existing = document.getElementById('oy-employee-discount-info');
    if (existing) {
      console.log('[올리브영 할인 한도] 기존 할인 정보 제거');
      existing.remove();
    }

    // 장바구니 페이지가 아니면 종료
    const totalPriceInfo = document.querySelector('.total_price_info .sum_price');
    if (!totalPriceInfo) {
      console.log('[올리브영 할인 한도] 장바구니 페이지가 아님');
      return;
    }

    // 상품금액과 배송비 분리 추출
    const breakdown = getCartPriceBreakdown();
    const totalPrice = breakdown ? breakdown.productPrice : getCartTotalPrice();
    const shippingFee = breakdown ? breakdown.shippingFee : 0;
    console.log('[올리브영 할인 한도] 상품금액:', totalPrice, '배송비:', shippingFee);
    if (!totalPrice) {
      console.log('[올리브영 할인 한도] 총 판매가를 찾을 수 없음');
      return;
    }

    // 잔여 한도가 없으면 종료
    if (limitData.limit === null) {
      console.log('[올리브영 할인 한도] 잔여 한도가 없음');
      return;
    }

    console.log('[올리브영 할인 한도] 잔여 한도:', limitData.limit);

    // 할인 계산 (배송비 제외한 상품금액에만 적용)
    const discountInfo = getDiscountInfo(totalPrice, limitData.limit);
    // 배송비를 최종 결제금액에 추가
    discountInfo.finalPrice += shippingFee;
    console.log('[올리브영 할인 한도] 할인 정보:', discountInfo, '(배송비 포함)');

    // UI 생성
    const discountDiv = document.createElement('div');
    discountDiv.id = 'oy-employee-discount-info';
    discountDiv.className = 'oy-employee-discount';
    discountDiv.innerHTML = `
      <div class="oy-discount-title">임직원 할인 적용 시</div>
      <div class="oy-discount-details">
        <div class="oy-discount-row">
          <span class="oy-discount-label">할인 금액</span>
          <span class="oy-discount-value discount">${formatPrice(discountInfo.discount)}</span>
        </div>
        <div class="oy-discount-row">
          <span class="oy-discount-label">사용 한도</span>
          <span class="oy-discount-value">${formatPrice(discountInfo.limitUsed)}</span>
        </div>
        <div class="oy-discount-row final">
          <span class="oy-discount-label">최종 결제금액</span>
          <span class="oy-discount-value final-price">${formatPrice(discountInfo.finalPrice)}</span>
        </div>
      </div>
    `;

    // sum_price 다음에 삽입
    totalPriceInfo.parentNode.insertBefore(discountDiv, totalPriceInfo.nextSibling);
    console.log('[올리브영 할인 한도] 할인 정보 표시 완료');
  }

  /**
   * 한도 데이터 업데이트 후 장바구니 정보도 갱신
   */
  function refreshCartInfo() {
    try {
      console.log('[올리브영 할인 한도] refreshCartInfo 호출됨');
      displayCartDiscountInfo();
    } catch (error) {
      console.error('[올리브영 할인 한도] refreshCartInfo 오류:', error);
    }
  }

  /**
   * 상품 상세에서 총 가격 추출
   */
  function getProductDetailPrice() {
    const priceEl = document.querySelector('.total-summary-amount');
    if (!priceEl) return null;

    const priceText = priceEl.textContent.trim().replace(/,/g, '');
    const price = parseInt(priceText, 10);
    return isNaN(price) ? null : price;
  }

  /**
   * 상품 상세에 임직원 할인 정보 표시
   */
  function displayProductDetailDiscountInfo() {
    console.log('[올리브영 할인 한도] 상품 상세 정보 표시 시작');

    // 이미 표시된 요소가 있으면 제거
    const existing = document.getElementById('oy-employee-discount-info-detail');
    if (existing) {
      console.log('[올리브영 할인 한도] 기존 상품 할인 정보 제거');
      existing.remove();
    }

    // 상품 상세 페이지가 아니면 종료
    const totalSummary = document.querySelector('.PurchaseBottom_total-summary__Dze_W');
    if (!totalSummary) {
      console.log('[올리브영 할인 한도] 상품 상세 페이지가 아님');
      return;
    }

    // 총 가격 가져오기
    const totalPrice = getProductDetailPrice();
    console.log('[올리브영 할인 한도] 상품 총 가격:', totalPrice);
    if (!totalPrice) {
      console.log('[올리브영 할인 한도] 상품 가격을 찾을 수 없음');
      return;
    }

    // 잔여 한도가 없으면 종료
    if (limitData.limit === null) {
      console.log('[올리브영 할인 한도] 잔여 한도가 없음');
      return;
    }

    console.log('[올리브영 할인 한도] 잔여 한도:', limitData.limit);

    // 할인 계산
    const discountInfo = getDiscountInfo(totalPrice, limitData.limit);
    console.log('[올리브영 할인 한도] 할인 정보:', discountInfo);

    // UI 생성
    const discountDiv = document.createElement('div');
    discountDiv.id = 'oy-employee-discount-info-detail';
    discountDiv.className = 'oy-employee-discount oy-employee-discount-detail';
    discountDiv.innerHTML = `
      <div class="oy-discount-title">임직원 할인 적용 시</div>
      <div class="oy-discount-details">
        <div class="oy-discount-row">
          <span class="oy-discount-label">할인 금액</span>
          <span class="oy-discount-value discount">${formatPrice(discountInfo.discount)}</span>
        </div>
        <div class="oy-discount-row">
          <span class="oy-discount-label">사용 한도</span>
          <span class="oy-discount-value">${formatPrice(discountInfo.limitUsed)}</span>
        </div>
        <div class="oy-discount-row final">
          <span class="oy-discount-label">최종 결제금액 (배송비 제외)</span>
          <span class="oy-discount-value final-price">${formatPrice(discountInfo.finalPrice)}</span>
        </div>
      </div>
    `;

    // total-summary 다음에 삽입
    totalSummary.parentNode.insertBefore(discountDiv, totalSummary.nextSibling);
    console.log('[올리브영 할인 한도] 상품 할인 정보 표시 완료');
  }

  /**
   * 한도 데이터 업데이트 후 상품 상세 정보도 갱신
   */
  function refreshProductDetailInfo() {
    try {
      console.log('[올리브영 할인 한도] refreshProductDetailInfo 호출됨');
      displayProductDetailDiscountInfo();
    } catch (error) {
      console.error('[올리브영 할인 한도] refreshProductDetailInfo 오류:', error);
    }
  }

  /**
   * 로그인 여부 확인
   */
  function isLoggedIn() {
    // 방법 1: li.mypage 클래스 확인 (장바구니 등)
    const mypageWithClass = document.querySelector('li.mypage');
    if (mypageWithClass) {
      return true;
    }

    // 방법 2: "마이페이지" 텍스트 링크 확인 (상품 상세 등)
    const allLinks = document.querySelectorAll('a');
    for (const link of allLinks) {
      if (link.textContent.trim() === '마이페이지') {
        return true;
      }
    }

    // 방법 3: "로그인" 텍스트가 없으면 로그인 상태로 간주
    const hasLoginLink = Array.from(allLinks).some(link =>
      link.textContent.trim() === '로그인'
    );

    if (!hasLoginLink) {
      return true;
    }

    return false;
  }

  /**
   * 초기화
   */
  function init() {
    console.log('[올리브영 할인 한도] 초기화 시작');

    // 로그인 여부 확인
    if (!isLoggedIn()) {
      console.log('[올리브영 할인 한도] 비로그인 상태 - 확장 프로그램 비활성화');
      return;
    }

    console.log('[올리브영 할인 한도] 로그인 상태 - 확장 프로그램 활성화');
    // 플로팅 UI 생성
    createFloatingUI();

    // 초기 데이터 로드
    fetchDiscountLimit().then(() => {
      // 장바구니 정보 표시
      refreshCartInfo();
      // 상품 상세 정보 표시
      refreshProductDetailInfo();
    });

    // 5분마다 자동 갱신
    setInterval(() => {
      if (!limitData.loading) {
        fetchDiscountLimit().then(() => {
          refreshCartInfo();
          refreshProductDetailInfo();
        });
      }
    }, 5 * 60 * 1000);

    // 장바구니: 총 결제예상금액 변경 감지
    const totalPriceElement = document.querySelector('.total_price_info .sum_price .tx_price .tx_num');
    if (totalPriceElement) {
      const cartObserver = new MutationObserver((mutations) => {
        console.log('[올리브영 할인 한도] 장바구니 총 결제예상금액 변경 감지');
        refreshCartInfo();
      });

      cartObserver.observe(totalPriceElement, {
        characterData: true,
        childList: true,
        subtree: true,
      });

      console.log('[올리브영 할인 한도] 장바구니 Observer 설정 완료');
    }

    // 상품 상세: 총 가격 변경 감지 (수량 변경 등)
    const productPriceElement = document.querySelector('.total-summary-amount');
    if (productPriceElement) {
      const productObserver = new MutationObserver((mutations) => {
        console.log('[올리브영 할인 한도] 상품 가격 변경 감지');
        refreshProductDetailInfo();
      });

      productObserver.observe(productPriceElement, {
        characterData: true,
        childList: true,
        subtree: true,
      });

      console.log('[올리브영 할인 한도] 상품 상세 Observer 설정 완료');
    }
  }

  /**
   * 헤더가 로드될 때까지 기다렸다가 초기화 (MutationObserver 방식)
   */
  function waitForHeaderAndInit() {
    console.log('[올리브영 할인 한도] 헤더 로드 대기 시작');

    // 즉시 로그인 확인 시도
    if (isLoggedIn()) {
      console.log('[올리브영 할인 한도] 헤더가 이미 로드됨');
      init();
      return;
    }

    // MutationObserver로 헤더 변경 감지
    const headerObserver = new MutationObserver((mutations, obs) => {
      console.log('[올리브영 할인 한도] DOM 변경 감지');

      if (isLoggedIn()) {
        console.log('[올리브영 할인 한도] 헤더 로드 완료 - Observer 중지');
        obs.disconnect();
        init();
      }
    });

    // body 전체를 감시
    headerObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 5초 후 타임아웃
    setTimeout(() => {
      headerObserver.disconnect();
      console.log('[올리브영 할인 한도] 헤더 로드 타임아웃 - 비로그인으로 간주');
    }, 5000);

    console.log('[올리브영 할인 한도] MutationObserver 설정 완료');
  }

  // 페이지 로드 완료 후 헤더 대기
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForHeaderAndInit);
  } else {
    waitForHeaderAndInit();
  }
})();
