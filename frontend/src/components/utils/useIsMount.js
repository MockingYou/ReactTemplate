import { useRef, useEffect } from 'react';

const useIsMount = () => {
  const isMountRef = useRef(false);
  useEffect(() => {
    isMountRef.current = true;
  }, []);
  return isMountRef.current;
};

export default useIsMount;