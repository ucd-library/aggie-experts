# Setup aggie experts
# ---------
AGGIE_EXPERTS_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

if [[ ! "$PATH" == *${AGGIE_EXPERTS_DIR}/bin* ]]; then
  export PATH="${PATH:+${PATH}:}${AGGIE_EXPERTS_DIR}/bin"
fi
