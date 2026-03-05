document.addEventListener('DOMContentLoaded', async () => {
  const acqrCdInput = document.getElementById('acqrCd');
  const cardNoInput = document.getElementById('cardNo');
  const cardAvalTermYmInput = document.getElementById('cardAvalTermYm');
  const saveBtn = document.getElementById('saveBtn');
  const successMessage = document.getElementById('successMessage');

  // 저장된 정보 불러오기
  const stored = await chrome.storage.local.get(['acqrCd', 'cardNo', 'cardAvalTermYm']);
  if (stored.acqrCd) acqrCdInput.value = stored.acqrCd;
  if (stored.cardNo) cardNoInput.value = stored.cardNo;
  if (stored.cardAvalTermYm) cardAvalTermYmInput.value = stored.cardAvalTermYm;

  // 저장 버튼 클릭
  saveBtn.addEventListener('click', async () => {
    const acqrCd = acqrCdInput.value.trim();
    const cardNo = cardNoInput.value.trim();
    const cardAvalTermYm = cardAvalTermYmInput.value.trim();

    // 유효성 검사
    if (!acqrCd || !cardNo || !cardAvalTermYm) {
      alert('모든 항목을 입력해주세요.');
      return;
    }

    if (!/^\d{16}$/.test(cardNo)) {
      alert('카드번호는 16자리 숫자여야 합니다.');
      return;
    }

    if (!/^\d{4}$/.test(cardAvalTermYm)) {
      alert('유효기간은 MMYY 형식(4자리 숫자)이어야 합니다.');
      return;
    }

    // 월(MM) 유효성 검사
    const mm = cardAvalTermYm.substring(0, 2);
    if (parseInt(mm, 10) < 1 || parseInt(mm, 10) > 12) {
      alert('유효하지 않은 월입니다. (01~12 사이여야 합니다)');
      return;
    }

    // 저장
    await chrome.storage.local.set({
      acqrCd,
      cardNo,
      cardAvalTermYm,
    });

    // 성공 메시지 표시
    successMessage.style.display = 'block';
    setTimeout(() => {
      successMessage.style.display = 'none';
    }, 3000);
  });

  // 숫자만 입력 허용
  cardNoInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '');
  });

  cardAvalTermYmInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '');
  });
});
